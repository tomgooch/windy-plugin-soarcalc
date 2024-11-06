const Rd: num = 287;							// Gas constant for dry air (J kg-1 K-1)
const Rv: num = 462;							// Gas constant for water vapour (J kg-1 K-1)
const g: num = 9.81;							// acceleration due to gravity (m s-2)
const Cp: num = 1004.67;						// Specific heat and constant pressure of dry air (J kg-1 K-1)
const rho: num = 1.21;							// density of air at surface (kg m-3)
const zeroC: num = 273.16;						// freezing point in Kelvin (K)
const adiabaticLapseRate: num = -0.00975;		// adiabatic lapse rate g/Cp (K m-1) 

export class Sounding
{
	n: number = 0;					// number of levels
	levels: SoundingLevel[];		// data for each level
	
	surfaceGh: number | null = null;
	surfaceDewPoint: number | null = null;
	surfaceT: number | null = null;
	surfaceTv: number | null = null;	// surface vertual temperature
	blTop: number | null = null;		// boundary layer height i.e. height of blue thermal (m)
	blDepth: number | null = null;		// boundary layer depth i.e. blTop - surface (m)
	cuBase: number | null = null;		// Cu cloud base (LCL) (m)
	Qs: number | null;					// heat flux arriving at the surface (Wm-2)
	cloud: number | null;				// cloud cover ratio
	Wstar: number | null = null;		// characteristic thermal updraft velocity (ms-2)
	Hcrit: number | null = null;		// height of critical updraft strength
	odBase: number | null = null;		// OD cloud base (CCL) (m)
	Ri: number | null = null;			// B/S ratio (Richardson number)
	
	constructor(meteogramForecast, hour: number, Qs: number, cloud: number)
	{
    	console.log("Sounding.constructor:", meteogramForecast, hour, Qs, cloud);
		this.Qs = Qs;
		this.cloud = cloud;
		if (meteogramForecast == null) return;
		
        const md = meteogramForecast.data.data;
        this.surfaceGh = meteogramForecast.data.header.modelElevation;
        const t: number = md.hours.indexOf(hour);
        if (t < 0) return;		// user has requested a time beyond the limit of the forecast availability

        const P0: number = getSeaLevelPressure(95000, md['gh-950h'][t]);
        var Vx: number;		// wind velocity x at blTop
        var Vy: number;		// wind velocity y at blTop
       
		this.levels = Array<SoundingLevel>();
		this.levels[this.n++] = new SoundingLevel('surface', this.surfaceGh, getPressure(P0, this.surfaceGh), md['temp-surface'][t], md['rh-surface'][t]/100, md['dewpoint-surface'][t], md['wind_u-surface'][t], md['wind_v-surface'][t]);
		this.surfaceDewPoint = this.levels[0].dewPoint;
		this.surfaceT = this.levels[0].T;
		this.surfaceTv = this.levels[0].Tv;

		for (const x of ['1000h', '950h', '925h', '900h', '850h', '800h', '700h', '600h', '500h', '400h', '300h', '200h', '150h'])
		{
			const gh = md['gh-' + x][t];
			if (gh > this.levels[0].gh)
				this.levels[this.n++] = new SoundingLevel(x, gh, Number(x.substring(0, x.length - 1)) * 100, md['temp-' + x][t], md['rh-' + x][t]/100, md['dewpoint-' + x][t], md['wind_u-' + x][t], md['wind_v-' + x][t]);
		}
			
		const Tv = Array.from(this.levels, (x) => x.Tv));
		const h = Array.from(this.levels, (x) => x.gh));

		for(var i=1; i<this.n; i++)
		{
			const packetTv: num = Tv[0] + adiabaticLapseRate * (h[i] - h[0]);
			const eLR = (Tv[i] - Tv[i-1]) / (h[i] - h[i-1]);
			//console.log(i + ': ' + this.levels[i].name + ' h=' + h[i] + ', packetT=' + (packetTv-zeroC).toFixed(3) +', T=' + (Tv[i]-zeroC).toFixed(3) + ', elr=' + eLR.toFixed(6));
			if (Tv[i] > packetTv)
			{
				this.blTop = (Tv[0] - Tv[i-1] + h[i-1] * eLR - h[0] * adiabaticLapseRate) / (eLR - adiabaticLapseRate);
				Vx =  this.levels[i-1].Vx + (this.levels[i].Vx - this.levels[i-1].Vx) * (this.blTop - h[i-1]) / (h[i] - h[i-1]);
				Vy =  this.levels[i-1].Vy + (this.levels[i].Vy - this.levels[i-1].Vy) * (this.blTop - h[i-1]) / (h[i] - h[i-1]);
				break;
			}
		}
		if (this.blTop == null)
		{
			this.blTop = h[n-1];
			Vx = this.levels[this.n-1].Vx;
			Vy = this.levels[this.n-1].Vy;
		}
		const Us = Array.from(this.levels, (x) => x.Us));
		const U = this.levels[0].U;
		for(var i=1; i<this.n; i++)
		{
			if (Us[i] < U)
			{
				this.odBase = h[i-1] + (h[i] - h[i-1]) * (U - Us[i-1]) / (Us[i] - Us[i-1]);
				break;
			}
		}
		
		this.blDepth = this.blTop - h[0];
		if (this.blDepth <= 0) this.blDepth = 0;
		
		this.cuBase = this.levels[0].gh + getCuBase(this.levels[0].T, this.levels[0].dewPoint);
		
		if (this.Qs != null)
		{
			this.Wstar = getWstar(this.Qs, this.blDepth, this.levels[0].U);
			this.Hcrit = this.surfaceGh + getZcrit(0.875, this.Wstar) * this.blDepth;
		}
		
		// Buoyancy/Shear ratio
		// we take wind half way between surface and blTop
		if (this.Wstar != null)
		{
			if (this.Wstar == 0)
			{
				this.Ri = 0;
			}
			else
			{
				const dVx: number = (Vx - this.levels[0].Vx) / 2;
				const dVy: number = (Vy - this.levels[0].Vy) / 2;
				const dV2: number = dVx * dVx + dVy * dVy;
				if (dV2 > 0.000001)
					this.Ri = this.Wstar * this.Wstar / dV2;
			}
		}
		console.log("/Sounding.constructor:", this);
	}
}
export class SoundingLevel
{
	name: string;
	gh: number;						// geopotential height i.e. height above msl (m)
	P: number;						// pressure (Pa)
	T: number;						// temperature (K)
	rh: number;						// relative humidity
	dewPoint: number				// dew point (K)
	U: number;						// mixing ratio
	Tv: number;						// virtual (density) temperature (K)
	Us: number;						// saturation mixing ratio at this temp / pressure
	Vx: number;						// wind velocity x (ms-1)
	Vy: number;						// wind velocity y (ms-1)

	constructor(name: string, gh: number, p: number, T: number, rh: number, dewPoint: number, Vx: number, Vy: number)
	{
	    this.name = name;
	    this.gh = gh;					
	    this.P = p;		
	    this.T = T;
	    this.rh = rh;
	    this.dewPoint = dewPoint;
	    
	    this.U = getMixingRatio(rh, T, p);
	    this.Tv = getVirtualTemp(T, this.U);
	    this.Us = getSaturationMixingRatio(T, p);
	    
	    this.Vx = Vx;
	    this.Vy = Vy;
	    //console.log(this);
	}
}
function getPressure(P0: number, h: number): number
{
	// get pressure at known height
	return P0 * Math.pow(1 - 0.0000225577 * h, 5.25588);
}
function getSeaLevelPressure(P: number, h: number): number
{
	// get sea level pressure from pressure at known height
	return P * Math.pow(1 - 0.0000225577 * h, -5.25588);
}

function getCuBase(surfaceTemp: num, surfaceDewPoint: num): num
{
	// extremely simple calculation of Cu cloudbase
	return 120 * (surfaceTemp - surfaceDewPoint);
}
function getMixingRatio(relativeHumidity: num, temperature: num, pressure: num): num
{
	const vapourPressure = relativeHumidity * getSaturatedVapourPressure(temperature);
	return (Rd/Rv) * vapourPressure / (pressure - vapourPressure);
}
function getSaturationMixingRatio(temperature: num, pressure: num): num
{
	const saturatedVapourPressure = getSaturatedVapourPressure(temperature);
	return (Rd/Rv) * saturatedVapourPressure / (pressure - saturatedVapourPressure);
}
function getVirtualTemp(actualTemp: num, mixingRatio: num): num
{
	// returns the virtual temperature
	return actualTemp * (1 + ((Rv - Rd) / Rd) * mixingRatio);
}
function getSaturatedVapourPressure(T: num): num
{
	// the Tetens equation
	// T = temperature (Centrigrade)
	// returns vapour pressure in Pascals
	const Tc = T - zeroC;
	return 610.78 * Math.exp(17.27 * Tc / (Tc + 237.3));
}
function getWstar(Qs: num, blDepth: num, mixingRatio: num): num
{
	console.log("getWstar:", Qs);
	const temperatureBar: num = 288;											// average surface temperature
	
	const beta: num = 6;														// Bowen ratio sensible/latent heat flux
	const Qg: num = 0.1 * Qs;													// heat flux into the ground
	const QhTilde: num = beta * (Qs - Qg)/(1 + beta);							// sensible heat flux
	const Qh: num = QhTilde / (rho * Cp);										// kinematic sensible heat flux
	const Qov: num = Qh * ( 1 + ((Rv - Rd) / Rd) * mixingRatio);				// Qov kinematic virtual sensible heat flux
	const Wstar = Math.pow(Qov * blDepth * g / temperatureBar, 1/3);			// characteristic updraft velocity
	console.log("/getWstar:", Wstar);
	return Wstar;
}
function getPotentialTemperature(T: number, P: number, P0: number): number
{
	return T * Math.pow(P0/P, Rd/Cp);
}
function getZcrit(wCrit: num, wStar: num): num
{
	// employ Newton–Raphson method to find z (z/blDepth) for given value of w (Wcrit/Wstar)
	console.log("getZcrit:", wCrit, wStar);
	var z: num;
	if (wCrit > wStar)
	{
		z = 0;
	}
	else
	{
/*		for (var i=0; i<101; i++)
		{
			z = 0.01 * i;
			console.log("i=", i, "w=", Math.pow(z, 1/3) * (1 - 1.1*z), "dzdw=", 1/3 * Math.pow(z, -2/3) * (1 - 1.1*z) - 1.1 * Math.pow(z, 1/3))
		}

*/
		const w0: num = wCrit / wStar;
		var w: num;
		var dwdz: num;
		var dz: num;
		z = 0.9;
		do
		{
			w = 2.2 * Math.pow(z, 1/3) * (1 - 1.1*z);
			dwdz = 2.2 * (1/3 * Math.pow(z, -2/3) * (1 - 1.1*z) - 1.1 * Math.pow(z, 1/3));
			dz = (w - w0)/dwdz;
			console.log("z=", z, "w=", w, "dwdz=", dwdz, "dz=", dz);
			z = z - dz;
		} while (Math.abs(dz) > 0.001);
	}
	console.log("/getZcrit:", z);
	return z;
}


