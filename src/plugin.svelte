<div class="plugin__mobile-header">
    {title}
</div>
<div>
	<div style="color:yellow">{title} v{version}: {_model}: {format_time(_hour)}</div>
	<span style="font-size:10px;vertical-align:top">{format_latlon(_loc)}</span>
	
<table style="width:100%">
<tr>
<td style=";text-align:right;vertical-align:top">
    T: {format_temp(_sounding?.surface?.T)}
    <br>Tdew: {format_temp(_sounding?.surface?.dewPoint)}
    <br>Elev: {format_height(_sounding?.surface?.gh)}
    <br>ElevA: {format_height(_sounding?.actualElevation)}
    <br>
</td>
<td style=";text-align:right;vertical-align:top">
    {#if _sounding?.blTop?.gh == _sounding?.surface?.gh}
    	BL top: <span style="opacity:0.6">{format_height(_sounding?.blTop?.gh)}</span>
    {:else}
    	BL top: {format_height(_sounding?.blTop?.gh)}
    {/if}
    {#if _sounding?.Hcrit == _sounding?.surface?.gh}
    	<br>Hcrit: <span style="opacity:0.6">{format_height(_sounding?.Hcrit)}</span>
    {:else}
    	<br>Hcrit: {format_height(_sounding?.Hcrit)}
    {/if}
    {#if _sounding?.cuPossible}
		<br>CU base: {format_height(_sounding?.cuBase?.gh)}
   {:else}
   		<br>CU base: <span style="opacity:0.6">{format_height(_sounding?.cuBase?.gh)}</span>
   {/if}
    {#if _sounding?.odPossible}
		<br>OD base: {format_height(_sounding?.odBase?.gh)}
    {:else}
    	<br>OD base: <span style="opacity:0.6">{format_height(_sounding?.odBase?.gh)}</span>
    {/if}
</td>
<td style=";text-align:right;vertical-align:top">
    Cloud: {format_number(_sounding?.cloud, 2)}
    <br>Qs: {format_number(_sounding?.Qs, 0)}
    <br>W*: {format_wind(_sounding?.Wstar)}
    <br>Shear: {format_wind(_sounding?.blShear)}
    <br>B/S: {format_number(_sounding?.Ri, 2)}
</td>
</tr>
</table>
</div>


<script lang="ts">
    import { getMeteogramForecastData } from '@windy/fetch';
    import store from '@windy/store'
    import { map, markers} from '@windy/map';
    import { isValidLatLonObj } from '@windy/utils';
    import { singleclick } from '@windy/singleclick';
    import metrics from '@windy/metrics';
    import { onDestroy, onMount } from 'svelte';
    import config from './pluginConfig';
    import type { LatLon } from '@windy/interfaces.d';
    import SunCalc from 'suncalc';
    import { getLatLonInterpolator } from '@windy/interpolator';
	import broadcast from '@windy/broadcast';
	import { Sounding } from './SoarCalc';
	
    let marker: L.Marker | null = null;
    let _loc: LatLon;
    let _popupShown: boolean = false;

	let _sounding2: Sounding | null = null;
    let _sounding: Sounding | null = null;
    let _meteogramForecast: any | null = null;
    let _interpolator: any = null;
    let _overlay: string | null = null;
    let _model: string | null = null;
    let _path: string;
    let _hour: number | null = null;
   
    const { title, name, version } = config;

    const draggablePulsatingIcon = new L.DivIcon({
        className: 'icon-dot wp-mb-mg-cursor-move',
        html: '<div class="pulsating-icon repeat"></div>',
        iconSize: [10, 10],
        iconAnchor: [5, 5],
    });

    const hideMarker = () => {
        if (marker) {
            marker.remove();
            marker = null;
        }
    };
    function showMarker()
    {
		hideMarker();
		
	    marker = L.marker({lat:_loc.lat, lng:_loc.lon}, {
	        draggable: true,
	        icon: draggablePulsatingIcon,
	    }).addTo(map);
	    
	    if (!_popupShown)
	    {
			marker.bindPopup(getPopupMessage()).openPopup();
			_popupShown = true;
	    }

	    marker.on('dragend', function (event) {
	        const { lat, lng } = event.target.getLatLng();
	        _loc = { lat, lon: lng };
	        updateForecast();
	    });
    }

    // If plugin is opened from RH menu, it is called with location
    // if not, the location param is undefined
    export const onopen = (location?: LatLon) => {
        if (isValidLatLonObj(location)) {
       		_loc = location;
        	showMarker();
            updateInterpolator(store.get('product'), store.get('overlay'));
        }
        console.log('markers', markers);
    };

    onMount(() => {
        singleclick.on(name, onSingleClick);
        singleclick.on('sounding', onSingleClick);
        singleclick.on('detail', onSingleClick);
        broadcast.on('redrawFinished', onRedrawFinished);
    });

    onDestroy(() => {
        singleclick.off(name, onSingleClick);
        singleclick.off('sounding', onSingleClick);
        singleclick.off('detail', onSingleClick);
        broadcast.off('redrawFinished', onRedrawFinished);
        hideMarker();
    });
    
	function onRedrawFinished(params: any)
	{
		console.log('onRedrawFinished', params);
		_interpolator = null;
		//_level = params.level;
		_path = params.path;
		const dateString: string = _path.substring(0,4) + '-' + _path.substring(4,6) + '-' + _path.substring(6,8) + 'T' + _path.substring(8,10) + ':00:00Z';
		_hour = new Date(dateString).getTime();
		updateInterpolator(params.product, params.overlay);
	}
    function onSingleClick(location: LatLon)
    {
    	console.log("onSingleClick:", location);
         _loc = location;
        showMarker();
        updateForecast();
    }
// **********************************************************
	function updateInterpolator(model: string, overlay: string)
	{
		console.log('updateInterpolator', model, overlay);
	    getLatLonInterpolator().then((interpolator) => {
			_interpolator = interpolator;
			_overlay = overlay;
			if (model != _model)
			{
				_model = model;
				updateForecast();
			}
			else
			{
		    	updateSounding();
			}
		});
	}
    function updateForecast()
    {
 		console.log('updateForecast:', _model, _loc);
    	if (!isValidLatLonObj(_loc))
    	{
    		_sounding = null;
    		return;
    	}
    	if (_model == null)
    		_model = store.get('product');

		//getPointForecastData(_model, {lat:_loc.lat, lon:_loc.lon, step:1}).then((pointForecastData) =>{
		//	console.log("pointForecast", pointForecastData);
		//});
 	    getMeteogramForecastData(_model, {lat:_loc.lat, lon:_loc.lon, step:1}).then((meteogramForecast) => {
	 	    _meteogramForecast = meteogramForecast;
        	updateSounding();
		});
    }
    function updateSounding()
    {
 		console.log("updateSounding: ", _hour, _overlay, _loc, _meteogramForecast);

    	if (_hour == null)
    		_hour = getHour();

		var cloud: number | null = null;
		var Qs: number | null = null;
    	if (_interpolator != null && isValidLatLonObj(_loc) && _hour != null)
    	{
			const values = _interpolator(_loc);
			//console.log("calculateQs: ", _overlay, values);

			if (Array.isArray(values))
			{
				if (_overlay == 'clouds')
				{
				   	cloud = values[0] / 100;
				   	//rain = values[1];
					Qs = (1-cloud) * getQs0(_hour, _loc);
				}
				else if (_overlay == 'solarpower')
				{
					Qs = values[0];
					cloud = 1 - (values[0] / getQs0(_hour, _loc));
				}
			}
    	}

        _sounding = new Sounding(_meteogramForecast, _hour, Qs, cloud);
        if (_sounding.surface == null)
        	_sounding = null;
        _sounding2 = new Sounding(_meteogramForecast, _hour, Qs, cloud, true);
        if (_sounding2.surface == null)
        	_sounding2 = null;
    }
    function getQs0(hour: number, loc: LatLon): number
    {
    	// get insolation corrected only for sun altitude
	    var sunAltitude: number = SunCalc.getPosition(new Date(hour), loc.lat, loc.lon).altitude;
		if (sunAltitude <= 0) sunAltitude = 0;
		const Qs0: number = 1000 * Math.sin(sunAltitude);
    	//console.log("/getQs0:", format_angle(sunAltitude), Qs0);
    	return Qs0;
    }
    function getHour(): number | null
    {
    	// if we are invoked without triggering a re-draw we do not necessarily have the hour/timepoint on the forecast
    	// so we calculate it from the stored timestamp from the slider by finding the closest hour
    	
    	if (_meteogramForecast == null) return null;
    	
    	console.log('getHour()');
    	
    	const timestamp = store.get('timestamp');
        const hours = _meteogramForecast.data.data.hours;
        var h = hours[0];
        var dt = Math.abs(timestamp - h);
        for (var i: number = 1; i < hours.length; i++)
        {
        	if (Math.abs(timestamp - hours[i]) > dt) return h;

       		h = hours[i];
       		dt = Math.abs(timestamp - h);
        }
		return null;
    }
// **********************************************************
    function format_height(x: number | null | undefined): string
    {
    	if (x == null) return '';
    	return metrics.altitude.convertNumber(x, 0);
    }
    function format_temp(x: number | null | undefined): string
    {
    	if (x == null) return '';
    	return metrics.temp.convertNumber(x, 1).toFixed(1);
    }
    function format_wind(x: number | null | undefined): string
    {
    	if (x == null) return '';
		return metrics.wind.convertNumber(x, 2);
    }
    function format_latlon(x: LatLon): string
    {
    	if (!isValidLatLonObj(x)) return '';

    	var latitude: string;
    	var longitude: string;
    	if (x.lat >= 0)
    		latitude = toDegreesAndDecimalMinutes(x.lat) + 'N'
    	else
    		latitude = toDegreesAndDecimalMinutes(Math.abs(x.lat)) + 'S'

    	if (x.lon >= 0)
    		longitude = toDegreesAndDecimalMinutes(x.lon) + 'E'
    	else
    		longitude = toDegreesAndDecimalMinutes(Math.abs(x.lon)) + 'W'

		return latitude + '  ' + longitude;
    }
    function toDegreesAndDecimalMinutes(x: number): string
    {
		const degrees: number = Math.floor(x);
		const minutes: number = (x - degrees) * 60;
		return degrees + ' ' + minutes.toFixed(3);
    }
    function format_time(d: number | null | undefined): string
    {
    	if (d == null) return '';
    	const days: string[] = ['Sun', 'Mon', 'Tues', 'Weds', 'Thurs', 'Fri', 'Sat'];
    	const dt = new Date(d);
		return days[dt.getUTCDay()] + ' ' + dt.getUTCDate() + ', ' + dt.getUTCHours() + ':00';
    }
    function format_number(x: number | null | undefined, n: number): string
    {
    	if (x == null) return '';
		return x.toFixed(n);
    }
    function getPopupMessage(): string
	{
		console.log("metric", metrics);
		var msg: string = "<p>" + title + " v" + version + "</p>"

		msg += "<p>Thermal Soaring parameters as per RASP based on the current forecast model</p>"
	
		msg += "<p>Legend</p>"

		msg += "<p>All layers..."
		msg += "<br>T = surface temperature (" + metrics.temp.metric + ")"
		msg += "<br>Tdew = surface dew point temperature (" + metrics.temp.metric + ")"
		msg += "<br>Elev = Model Elevation (" + metrics.altitude.metric + ")"
		msg += "<br>ElevA = Actual Elevation (" + metrics.altitude.metric + ")"
		msg += "<br>BL top = boundary layer top (dry thermal height) (" + metrics.altitude.metric + ")"
		msg += "<br>Cu base = Cumulous cloud base (" + metrics.altitude.metric + ")"
		msg += "<br>OD base = Overdeveloped / Spreadout cloud base (" + metrics.altitude.metric + ")"
		msg += "<br>Shear = Boundary layer wind shear (" + metrics.wind.metric + ")"
		msg += "</p>"
		
		msg += "<p>Clouds/Solar power layers only..."
		msg += "<br>Cloud = total cloud cover"
		msg += "<br>Qs = surface insolation (W/m2)"
		msg += "<br>W* = thermal updraft velocity (" + metrics.wind.metric + ")"
		msg += "<br>B/S = Bouyancy/Shear ratio"
		msg += "<br>Hcrit = height at which updraft falls below " + format_wind(0.9) + metrics.wind.metric + " (" + metrics.altitude.metric + ")"
		msg += "</p>"
		return msg;
	}
</script>

<style lang="less">
    img {
        width: 100%;
    }
    p {
        line-height: 1.8;
    }
    :global(.wp-mb-mg-cursor-move) {
        z-index: 1000;
        cursor: move;
    }
</style>
