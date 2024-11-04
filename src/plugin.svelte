<div class="plugin__mobile-header">
    {title}
</div>
<div>
	<div style="color:yellow">SoarCalc: {_model} : {format_time(_hour)}</div>
	<span style="font-size:10px;vertical-align:top">{format_latlon(_loc)}</span>
	
<table style="width:100%">
<tr>
<td style=";text-align:right;vertical-align:top">
    T: {format_temp(_sounding?.levels[0].T)}
    <br>Tdew: {format_temp(_sounding?.levels[0].dewPoint)}
    <br>Tv: {format_temp(_sounding?.levels[0].Tv)}
    <br>B/S: {format_number(_sounding?.Ri, 2)}
</td>
<td style=";text-align:right;vertical-align:top">
    {#if _sounding?.blTop < _sounding?.levels[0].gh + 10}
    	BL top: <span style="opacity:0.6">{format_height(_sounding?.blTop)}</span>
    {:else}
    	BL top: {format_height(_sounding?.blTop)}
    {/if}
    {#if _sounding?.cuBase > _sounding?.blTop}
    	<br>Cu base: <span style="opacity:0.6">{format_height(_sounding?.cuBase)}</span>
    {:else}
    	<br>Cu base: {format_height(_sounding?.cuBase)}
    {/if}
    {#if _sounding?.odBase > _sounding?.blTop}
    	<br>OD base: <span style="opacity:0.6">{format_height(_sounding?.odBase)}</span>
    {:else}
    	<br>OD base: {format_height(_sounding?.odBase)}
    {/if}
    <br>Elev: {format_height(_sounding?.levels[0].gh)}
</td>
<td style=";text-align:right;vertical-align:top">
    Cloud: {format_number(_sounding?.cloud, 2)}
    <br>Qs: {format_number(_sounding?.Qs, 0)}
    <br>W*: {format_number(_sounding?.Wstar, 2)}
    {#if _sounding?.Hcrit < _sounding?.levels[0].gh + 10}
    	<br>Hcrit: <span style="opacity:0.6">{format_height(_sounding?.Hcrit)}</span>
    {:else}
    	<br>Hcrit: {format_height(_sounding?.Hcrit)}
    {/if}
</td>
</tr>
</table>
</div>


<script lang="ts">
    import { getPointForecastData } from '@windy/fetch';
    import { getMeteogramForecastData } from '@windy/fetch';
    import store from '@windy/store'
    import bcast from '@windy/broadcast';
    import { map, markers} from '@windy/map';
    import { isValidLatLonObj, qs, normalizeLatLon } from '@windy/utils';
    import { singleclick } from '@windy/singleclick';
    import metrics from '@windy/metrics';
    import { onDestroy, onMount } from 'svelte';
    import config from './pluginConfig';
    import type { LatLon } from '@windy/interfaces.d';
    import SunCalc from 'suncalc';
    import { getLatLonInterpolator } from '@windy/interpolator';
    import { Sounding, getSeaLevelPressure, getPressure } from './SoarCalc.ts';
	import broadcast from '@windy/broadcast';
	
    let marker: L.Marker | null = null;
    let _loc: LatLon | null = null;
    let _popupShown: bool = false;

    let _sounding = null;
    let _pointForecast = null;
    let _meteogramForecast = null;
    let _interpolator = null;
    let _overlay: string | null = null;
    let _model: string | null = null;
    let _level: string | null = null;
    let _path: string | null = null;
    let _hour: number | null = null;
   
    const { title, name } = config;

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
		
	    marker = L.marker(_loc, {
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
        if (_model == null)
        	_model = store.get('product');
        if (isValidLatLonObj(location)) {
       		_loc = location;
        	showMarker();
            updateForecast();
        }
        console.log('markers', markers);
    };

    onMount(() => {
        singleclick.on(name, onSingleClick);
        singleclick.on('sounding', onSingleClickSounding);
        broadcast.on('redrawFinished', onRedrawFinished);
    });

    onDestroy(() => {
        singleclick.off(name, onSingleClick);
        singleclick.off('sounding', onSingleClickSounding);
        broadcast.off('redrawFinished', onRedrawFinished);
        hideMarker();
    });
    
	function onRedrawFinished(params)
	{
		console.log('onRedrawFinished', params);
		_interpolator = null;
	    getLatLonInterpolator().then((interpolator) => {
			_interpolator = interpolator;
			_overlay = params.overlay;
			_level = params.level;
			_path = params.path;
			const dateString: string = _path.substring(0,4) + '-' + _path.substring(4,6) + '-' + _path.substring(6,8) + 'T' + _path.substring(8,10) + ':00:00Z';
			_hour = new Date(dateString).getTime();
			if (params.product != _model)
			{
				_model = params.product;
				updateForecast();
			}
			else
			{
		    	updateSounding();
			}
		});
	}
    function onSingleClick(location: LatLon)
    {
    	console.log("onSingleClick:", location);
         _loc = location;
        showMarker();
        updateForecast();
    }
    function onSingleClickSounding(location: LatLon)
    {
    	console.log("onSingleClickSounding:", location);
         _loc = location;
        showMarker();
        updateForecast();
    }
// **********************************************************
    function updateForecast()
    {
 		console.log('updateForecast:', _model, _loc);
    	if (!isValidLatLonObj(_loc)) return;

 	    getMeteogramForecastData(_model, _loc).then((meteogramForecast) => {
	 	    _meteogramForecast = meteogramForecast;
        	updateSounding();
		});
    }
    function updateSounding()
    {
 		console.log("updateSounding: ", _hour, _overlay, _loc, _meteogramForecast);

    	if (_hour == null)
    		_hour = getHour();

		var cloud: num | null = null;
		var Qs: num | null = null;
    	if (_interpolator != null && _loc != null && _hour != null)
    	{
			const values = _interpolator(_loc);
			console.log("calculateQs: ", _overlay, values);

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
					cloud = 1 - (Qs / getQs0(_hour, _loc));
				}
			}
    	}
   		
    	if (_meteogramForecast == null) return;

        _sounding = new Sounding(_meteogramForecast, _hour, Qs, cloud);
    }
    function getQs0(hour: number, loc: LatLon): number
    {
    	// get insolation corrected only for sun altitude
	    var sunAltitude: number = SunCalc.getPosition(hour, loc.lat, loc.lon).altitude;
		if (sunAltitude <= 0) sunAltitude = 0;
		const Qs0: number = 1000 * Math.sin(sunAltitude);
    	console.log("/getQs0:", format_angle(sunAltitude), Qs0);
    	return Qs0;
    }
    function getHour(): number
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
    }
// **********************************************************
	function getBlTop(sounding: Sounding): string
	{
		if (sounding == null) return '';
		if (sounding.blTop < sounding.levels[0].gh + 10)
			return '<span style="opacity: 0.6">' + format_height(sounding.blTop) + '</span>'
		else
			return format_height(sounding.blTop);
	}
	function getHcrit(sounding: Sounding): string
	{
		if (sounding == null) return '';
		if (sounding.Hcrit < sounding.levels[0].gh + 10)
			return '<span style="opacity: 0.6">' + format_height(sounding.Hcrit) + '</span>'
		else
			return format_height(sounding.Hcrit);
	}
	function getCuBase(sounding: Sounding): string
	{
		if (sounding == null) return '';
		if (sounding.cuBase > sounding.blTop)
			return '<span style="opacity: 0.6">' + format_height(sounding.cuBase) + '</span>'
		else
			return format_height(sounding.cuBase);
	}
	function getOdBase(sounding: Sounding): string
	{
		if (sounding == null) return '';
		if (sounding.odBase > sounding.blTop)
			return '<span style="opacity: 0.6">' + format_height(sounding.odBase) + '</span>'
		else
			return format_height(sounding.odBase);
	}
    function format_height(x: number): string
    {
    	if (x == null) return '';
    	return metrics.altitude.convertNumber(x, 0);
    }
    function format_temp(x: number): string
    {
    	if (x == null) return '';
    	return metrics.temp.convertNumber(x, 1).toFixed(1);
    }
    function format_press(x: number): string
    {
    	if (x == null) return '';
		return metrics.pressure.convertNumber(x, 2);
    }
    function format_velocity(x: number): string
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
    function format_time(d: number): string
    {
    	if (d == null) return '';
    	const days: string[] = ['Sun', 'Mon', 'Tues', 'Weds', 'Thurs', 'Fri', 'Sat'];
    	const dt = new Date(d);
		return days[dt.getUTCDay()] + ' ' + dt.getUTCDate() + ' ' + dt.getUTCHours() + ':00';
    }
    function format_number(x: number, n: number): string
    {
    	if (x == null) return '';
		return x.toFixed(n);
    }
    function format_angle(x: number): string
    {
    	if (x == null) return '';
		return (x * 180 / Math.PI).toFixed(2);
	}
	function getPopupMessage(): string
	{
		console.log("metric", metrics);
		var msg: string = "<p>SoarCalc:</p>"

		msg += "<p>Soaring Prediction parameters as per RASP but based on the current forecast model</p>"

		msg += "<p>All layers..."
		msg += "<br>T = surface temperature (" + metrics.temp.metric + ")"
		msg += "<br>Tdew = surface dew point temperature (" + metrics.temp.metric + ")"
		msg += "<br>Tv = surface virtual (density) temperature (" + metrics.temp.metric + ")"
		msg += "<br>B/S = Bouyancy/Shear ratio"
		msg += "<br>BL top = boundary layer top (dry thermal height) (" + metrics.altitude.metric + ")"
		msg += "<br>Cu base = Cumulous cloud base (" + metrics.altitude.metric + ")"
		msg += "<br>OD base = Overdeveloped / Spreadout cloud base (" + metrics.altitude.metric + ")"
		msg += "<br>Elev = Model Elevation (" + metrics.altitude.metric + ")"
		msg += "</p>"
		
		msg += "<p>Clouds/Solar power layers only..."
		msg += "<br>Cloud = total cloud cover"
		msg += "<br>Qs = surface insolation (W/m2)"
		msg += "<br>W* = thermal updraft velocity (" + metrics.wind.metric + ")"
		msg += "<br>Hcrit = height at which updraft falls below 1.75kts (" + metrics.altitude.metric + ")"
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
