const Rd: num = 287;							// Gas constant for dry air (J kg-1 K-1)
const Rv: num = 462;							// Gas constant for water vapour (J kg-1 K-1)
const g: num = 9.81;							// acceleration due to gravity (m s-2)
const Cp: num = 1004.67;						// Specific heat and constant pressure of dry air (J kg-1 K-1)
const rho: num = 1.21;							// density of air at surface (kg m-3)
const zeroC: num = 273.16;						// freezing point in Kelvin (K)
const adiabaticLapseRate: num = -0.00975;		// adiabatic lapse rate g/Cp (K m-1) 

export class Sounding
{
	levels: SoundingLevel[];					// data for each level from the forecast model
	
	surface: SoundingLevel | null = null;		// surface (levels[0])
	blTop: SoundingLevel | null = null;			// BL top. neutral boyancy level of parcel convectively raised from surface (m)
	odBase: SoundingLevel | null = null;		// Overcast Development cloud base (BL CL) (m)
	cuBase: SoundingLevel | null = null;		// Cu cloud base (LCL) (m)

	blShear: number | null = null;			// boundary layer wind shear (ms-1)
	blDepth: number | null = null;			// boundary layer depth i.e. blTop - surface (m)
	Qs: number | null;						// heat flux arriving at the surface (Wm-2)
	cloud: number | null;					// cloud cover ratio
	Wstar: number | null = null;			// characteristic thermal updraft velocity (ms-2)
	Hcrit: number | null = null;			// height of critical updraft strength
	Ri: number | null = null;				// B/S ratio (Richardson number)
	blU: number | null = null;				// BL average mixing ratio

	// these quantities are only applicable to morning sounding above the well mixed zone
	Tcon: number | null = null;				// Tcon convective trigger temperature
	ccl: SoundingLevel | null = null;		// Convective Condensation Level (m)
	lcl: SoundingLevel | null = null;		// Lifting Condensation Level (aka Cu cloudbase) (m)

	constructor(meteogramForecast, hour: number, Qs: number, cloud: number, use100h: bool=false)
	{
    	console.log("Sounding.constructor:", meteogramForecast, hour, Qs, cloud, use100h);
		this.Qs = Qs;
		this.cloud = cloud;
		if (meteogramForecast == null) return;
		if (meteogramForecast.status != 200) return;
		
        const md = meteogramForecast.data.data;
        const t: number = md.hours.indexOf(hour);
        if (t < 0) return;		// user has requested a time beyond the limit of the forecast availability

        const surfaceT: number = md['temp-surface'][t];
        const surfaceTdew: number = md['dewpoint-surface'][t];

		var x: string = 'surface';
		var surfaceGh: number = meteogramForecast.data.header.modelElevation;
        var surfaceP: number = getPressure(getSeaLevelPressure(95000, md['gh-950h'][t]), surfaceGh);

		if (use100h && surfaceP > 100000)
		{
			x = '1000h';
			surfaceGh = md['gh-' + x][t];
		    surfaceP = 100000;
		}
        this.surface = new SoundingLevel('surface', surfaceGh, surfaceP, surfaceT, md['rh-' + x][t]/100, surfaceTdew, md['wind_u-' + x][t], md['wind_v-' + x][t]);

		this.levels = Array<SoundingLevel>();
		this.levels[0] = this.surface;

		for (const x of ['1000h', '950h', '925h', '900h', '850h', '800h', '700h', '600h', '500h', '400h', '300h', '200h', '150h'])
		{
			const gh = md['gh-' + x][t];
			if (gh > this.levels[0].gh)
				this.levels[this.levels.length] = new SoundingLevel(x, gh, Number(x.substring(0, x.length - 1)) * 100, md['temp-' + x][t], md['rh-' + x][t]/100, md['dewpoint-' + x][t], md['wind_u-' + x][t], md['wind_v-' + x][t]);
		}
			
		const Tv = Array.from(this.levels, (x) => x.Tv));
		const h = Array.from(this.levels, (x) => x.gh));

		for(var i=1; i<this.levels.length; i++)
		{
			const packetTv: num = Tv[0] + adiabaticLapseRate * (h[i] - h[0]);
			const eLR = (Tv[i] - Tv[i-1]) / (h[i] - h[i-1]);
			//console.log(i + ': ' + this.levels[i].name + ' h=' + h[i] + ', packetT=' + (packetTv-zeroC).toFixed(3) +', T=' + (Tv[i]-zeroC).toFixed(3) + ', elr=' + eLR.toFixed(6));
			if (Tv[i] > packetTv)
			{
				const gh = (Tv[0] - Tv[i-1] + h[i-1] * eLR - h[0] * adiabaticLapseRate) / (eLR - adiabaticLapseRate);
				if (gh - surfaceGh > 10)
					this.blTop = getInterpolatedLevel(this.levels[i], this.levels[i-1], gh, 'blTop');
				else
					this.blTop = this.surface;
				break;
			}
		}
		if (this.blTop == null)
			this.blTop = this.levels[this.levels.length-1];

		//this.ccl = getCondensationLevel(this.levels, this.surface.U, 'ccl');
		this.ccl = getCCLFromDewPoint(this.levels, 'ccl');
		this.Tcon = getPotentialTemperature(this.ccl.T, this.ccl.P, this.surface.P);
		
		this.blU = getBlAverageMixingRatio(this.levels, this.blTop);
		this.odBase = getCondensationLevel(this.levels, this.blU, 'odbase');

		this.blDepth = this.blTop.gh - h[0];
		if (this.blDepth <= 0) this.blDepth = 0;
		
		const cuBase: number = this.surface.gh + getCuBase(this.surface.T, this.surface.dewPoint);
		this.lcl = getInterpolatedLevel2(this.levels, cuBase, 'lcl');
		this.cuBase = this.lcl;
		
		if (this.Qs != null)
		{
			this.Wstar = getWstar(this.Qs, this.blDepth, this.surface.U);
			this.Hcrit = this.surface.gh + getZcrit(0.875, this.Wstar) * this.blDepth;
		}
		
		// Buoyancy/Shear ratio
		// we take wind half way between surface and blTop
		const dVx: number = (this.blTop.Vx - this.surface.Vx);
		const dVy: number = (this.blTop.Vy - this.surface.Vy);
		const dV2: number = dVx * dVx + dVy * dVy;
		this.blShear = Math.sqrt(dV2);
		if (this.Wstar != null)
		{
			if (this.Wstar == 0)
				this.Ri = 0;
			else if (dV2 > 0.000001)
				this.Ri = this.Wstar * this.Wstar / (4 * dV2);
		}
		console.log("/Sounding.constructor:", this);
	}
}
export class SoundingLevel
{
	name: string;
	gh: number;						// geopotential height i.e. height above msl (m)
	P: number;						// pressure (Pa)
	pa:number;						// pressure altitude (1013 altitude / flight level) (m)
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
	    this.Vx = Vx;
	    this.Vy = Vy;
	    
	    this.U = getMixingRatio(rh, T, p);
	    this.Tv = getVirtualTemp(T, this.U);
	    this.Us = getSaturationMixingRatio(T, p);
	    this.pa = getPressureAltitude(p);
	    
	    //console.log(this);
	}
}
function getInterpolatedLevel2(levels: SoundingLevel[], gh: number, name: string): SoundingLevel
{
		for(var i=1; i<levels.length; i++)
		{
			if (gh < levels[i].gh)
				return getInterpolatedLevel(levels[i], levels[i-1], gh, name);
		}
		return levels[levels.length-1];
}
function getInterpolatedLevel(level1: SoundingLevel, level0: SoundingLevel, gh: number, name: string): SoundingLevel
{
	//console.log("getInterpolatedLevel:", level1, level0, gh, name);
	const x = (gh - level0.gh) / (level1.gh - level0.gh);
	const P =  level0.P + (level1.P - level0.P) * x;
	const T =  level0.T + (level1.T - level0.T) * x;
	const rh =  level0.rh + (level1.rh - level0.rh) * x;
	const dewPoint =  level0.dewPoint + (level1.dewPoint - level0.dewPoint) * x;
	const Vx =  level0.Vx + (level1.Vx - level0.Vx) * x;
	const Vy =  level0.Vy + (level1.Vy - level0.Vy) * x;
	return new SoundingLevel(name, gh, P, T, rh, dewPoint, Vx, Vy);
}
function getPressure(P0: number, h: number): number
{
	// get pressure at known height
	return P0 * Math.pow(1 - 0.0000225577 * h, 5.25588);
}
function getPressureAltitude(P: number): number
{
	return (1/0.0000225577) * (1 - Math.pow(P/101325, 1/5.25588))
}
function getSeaLevelPressure(P: number, h: number): number
{
	// get sea level pressure from pressure at known height
	return P * Math.pow(1 - 0.0000225577 * h, -5.25588);
}

function getCuBase(surfaceTemp: num, surfaceDewPoint: num): num
{
	// extremely simple calculation of Cu cloudbase
	return 125 * (surfaceTemp - surfaceDewPoint);
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
	//console.log("getWstar:", Qs);
	const temperatureBar: num = 288;											// average surface temperature
	
	const beta: num = 6;														// Bowen ratio sensible/latent heat flux
	const Qg: num = 0.1 * Qs;													// heat flux into the ground
	const QhTilde: num = beta * (Qs - Qg)/(1 + beta);							// sensible heat flux
	const Qh: num = QhTilde / (rho * Cp);										// kinematic sensible heat flux
	const Qov: num = Qh * ( 1 + ((Rv - Rd) / Rd) * mixingRatio);				// Qov kinematic virtual sensible heat flux
	const Wstar = Math.pow(Qov * blDepth * g / temperatureBar, 1/3);			// characteristic updraft velocity
	//console.log("/getWstar:", Wstar);
	return Wstar;
}
function getPotentialTemperature(T: number, P: number, P0: number): number
{
	return T * Math.pow(P0/P, Rd/Cp);
}
function getZcrit(wCrit: num, wStar: num): num
{
	// employ Newton–Raphson method to find z (z/blDepth) for given value of w (Wcrit/Wstar)
	//console.log("getZcrit:", wCrit, wStar);
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
			//console.log("z=", z, "w=", w, "dwdz=", dwdz, "dz=", dz);
			z = z - dz;
		} while (Math.abs(dz) > 0.001);
	}
	//console.log("/getZcrit:", z);
	return z;
}
function getBlAverageMixingRatio(levels: SoundingLevel[], blTop: SoundingLevel): number
{
	const blDepth: num = blTop.gh - levels[0].gh;
	if (blDepth < 10)
		return levels[0].U;
		
	var sigma: num = 0;
	for (var i:int = 1; i<levels.length; i++)
	{
		if (levels[i].gh > blTop.gh)
		{
			sigma += (blTop.gh - levels[i-1].gh) * (blTop.U + levels[i-1].U) / 2;
			break;
		}
		sigma += (levels[i].gh - levels[i-1].gh) * (levels[i].U + levels[i-1].U) / 2;
	}
	return sigma / blDepth;
}
function getCondensationLevel(levels: SoundingLevel[], U: number, name: string): SoundingLevel
{
	for(var i=1; i<levels.length; i++)
	{
		if (levels[i].Us < U)
		{
			const gh = levels[i-1].gh + (levels[i].gh - levels[i-1].gh) * (U - levels[i-1].Us) / (levels[i].Us - levels[i-1].Us);
			return getInterpolatedLevel(levels[i], levels[i-1], gh, name);
		}
	}
	return levels[levels.length -1];
}
function getCCLFromDewPoint(levels: SoundingLevel[], name: string): SoundingLevel
{
	const dpLR: num = -0.002;
	const dps: num = levels[0].dewPoint;
	const hs: num = levels[0].gh;
	for(var i=1; i<levels.length; i++)
	{
		if (levels[i].T < dps + dpLR * (levels[i].gh - hs))
		{
			const eLR = (levels[i].T - levels[i-1].T) / (levels[i].gh - levels[i-1].gh);
			const gh = (levels[i-1].T - dps + hs * dpLR - levels[i-1].gh * eLR) / (dpLR - eLR);
			return getInterpolatedLevel(levels[i], levels[i-1], gh, name);
		}
	}
	return levels[levels.length -1];
}

