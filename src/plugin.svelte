<div>
	<div class="tooltipR" style="color:yellow">{title} v{version}: {_model}
		<span class="tooltiptext">Thermal Soaring parameters as per RASP based on the current forecast model</span>
	</div>
	<br><span style="font-size:10px;vertical-align:top">{format_time(_hour)} , {format_latlon(_sounding.Loc)}</span>
	
	{#if _sounding.status < 0}
	<div>{_sounding.message}</div>
	{/if}

	<table style="width:100%">
	<tr>
	<td style=";text-align:right;vertical-align:top">
		<div class="tooltipR">T: {format_temp(_sounding.surface?.T)}
			<span class="tooltiptext">Surface temperature ({metrics.temp.metric})</span>
		</div>
		<br><div class="tooltipR">Tdew: {format_temp(_sounding.surface?.dewPoint)}
			<span class="tooltiptext">Surface dew point temperature ({metrics.temp.metric})</span>
		</div>
		<br><div class="tooltipR">Elev: {format_height(_sounding.surface?.gh)}
			<span class="tooltiptext">Model elevation ({metrics.altitude.metric} amsl)</span>
		</div>
		<br><div class="tooltipR">ElevA: {format_height(_sounding.actualElevation)}
			<span class="tooltiptext">Actual elevation ({metrics.altitude.metric} amsl)</span>
		</div>
	</td>
	<td style=";text-align:right;vertical-align:top">
		<div class="tooltip">BL top: 
			{#if _sounding.blTop?.gh == _sounding.surface?.gh}
				<span style="opacity:0.6">{format_height(_sounding.blTop?.gh)}</span>
			{:else}
				{format_height(_sounding.blTop?.gh)}
			{/if}
			<span class="tooltiptext">Boundary Layer top (dry thermal height) ({metrics.altitude.metric} amsl)</span>
		</div>
		<br><div class="tooltip">CU base: 
			{#if _sounding.cuPossible}
				{format_height(_sounding.cuBase?.gh)}
			{:else}
				<span style="opacity:0.6">{format_height(_sounding.cuBase?.gh)}</span>
			{/if}
			<span class="tooltiptext">Cumulous cloud base ({metrics.altitude.metric} amsl)</span>
		</div>
		<br><div class="tooltip">OD base: 
			{#if _sounding.odPossible}
				{format_height(_sounding.odBase?.gh)}
			{:else}
				<span style="opacity:0.6">{format_height(_sounding.odBase?.gh)}</span>
			{/if}
			<span class="tooltiptext">Overdeveloped / Spreadout cloud base ({metrics.altitude.metric} amsl)</span>
		</div>
		<br><div class="tooltip">Shear: 
			{#if _sounding.blTop?.gh == _sounding.surface?.gh}
				<span style="opacity:0.6">{format_wind(_sounding.blShear)}</span>
			{:else}
				{format_wind(_sounding.blShear)}
			{/if}
			<span class="tooltiptext">Wind shear BL top vs surface ({metrics.wind.metric})</span>
		</div>

	</td>
	<td style=";text-align:right;vertical-align:top">
		<div class="tooltipL">Cloud: {format_number(_sounding.cloud, 2)}
			<span class="tooltiptext">Total cloud cover (Clouds overlay only)</span>
		</div>
		<br><div class="tooltipL">Qs: {format_number(_sounding.Qs, 0)}
			<span class="tooltiptext">Surface insolation (W/m2) (Clouds overlay only)</span>
		</div>
		<br><div class="tooltipL">W*: {format_wind(_sounding.Wstar)}
			<span class="tooltiptext">Thermal updraft velocity ({metrics.wind.metric}) (Clouds overlay only)</span>
		</div>
		<br><div class="tooltipL">Hcrit: 
			{#if _sounding.Hcrit == _sounding.surface?.gh}
				<span style="opacity:0.6">{format_height(_sounding.Hcrit)}</span>
			{:else}
				{format_height(_sounding.Hcrit)}
			{/if}
			<span class="tooltiptext">Height at which updraft falls below {format_wind(0.9)} {metrics.wind.metric} ({metrics.altitude.metric} amsl) (Clouds overlay only)</span>
		</div>
		<br><div class="tooltipL">B/S: {format_number(_sounding.Ri, 2)}
			<span class="tooltiptext">Bouyancy/Shear ratio (Clouds overlay only)</span>
		</div>
	</td>
	</tr>
	</table>
</div>

<script lang="ts">
    import { isMobileOrTablet } from '@windy/rootScope';
    import { getMeteogramForecastData } from '@windy/fetch';
    import store from '@windy/store'
    import { map } from '@windy/map';
    import { isValidLatLonObj } from '@windy/utils';
    import { singleclick } from '@windy/singleclick';
    import metrics from '@windy/metrics';
    import { onDestroy, onMount } from 'svelte';
    import config from './pluginConfig';
    import type { LatLon, MeteogramDataPayload } from '@windy/interfaces.d';
    import SunCalc from 'suncalc';
    import { getLatLonInterpolator } from '@windy/interpolator';
	import broadcast from '@windy/broadcast';
	import { Sounding } from './SoarCalc';
    import { HttpPayload } from '@windycom/plugin-devtools/types/client/http';
    //import bcast from '@windy/broadcast';
	
    let marker: L.Marker | null = null;
    let _loc: LatLon;

    let _sounding: Sounding = new Sounding(null, null, null, null, null);
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
	    
	    marker.on('dragend', function (event) {
	        const { lat, lng } = event.target.getLatLng();
	        _loc = { lat, lon: lng };
	        updateForecast();
	    });
    }

    // If plugin is opened from RH menu, it is called with location
    // if not, the location param is undefined
    export const onopen = (location?: LatLon) => {
		console.log('onopen', location);
		broadcast.emit('rqstClose', 'sounding');
		broadcast.emit('rqstClose', 'detail');
        if (isValidLatLonObj(location)) {
       		_loc = location;
        	showMarker();
            updateInterpolatorIfNeeded(store.get('product'), store.get('overlay'));
        }
    };

    onMount(() => {
        broadcast.on('redrawFinished', onRedrawFinished);
		broadcast.on('rqstOpen', onRqstOpen);
        singleclick.on(name, onSingleClick);
		//if (!isMobileOrTablet)
		//{
			singleclick.on('sounding', onSingleClick);
			singleclick.on('detail', onSingleClick);
		//}
	});

    onDestroy(() => {
        hideMarker();
        broadcast.off('redrawFinished', onRedrawFinished);
		broadcast.off('rqstOpen', onRqstOpen);
        singleclick.off(name, onSingleClick);
		//if (!isMobileOrTablet)
		//{
			singleclick.off('sounding', onSingleClick);
			singleclick.off('detail', onSingleClick);
		//}
    });
	function onSingleClick(location: LatLon)
    {
    	console.log("onSingleClick:", location);
         _loc = location;
        showMarker();
        updateForecast();
    }
	function onRqstOpen(plugin: any, location: LatLon)
    {
    	console.log("onRqstOpen:", plugin, location);
        if ((plugin == 'detail' || plugin == 'sounding') && isValidLatLonObj(location)) {
			onSingleClick(location);
		}
    }
  
	function onRedrawFinished(params: any)
	{
		console.log('onRedrawFinished', params);
		_interpolator = null;
		//_level = params.level;
		_path = params.path;
		const dateString: string = _path.substring(0,4) + '-' + _path.substring(4,6) + '-' + _path.substring(6,8) + 'T' + _path.substring(8,10) + ':00:00Z';
		_hour = new Date(dateString).getTime();
		updateInterpolatorIfNeeded(params.product, params.overlay);
	}
	function updateInterpolatorIfNeeded(model: string, overlay: string)
	{
		if (overlay == 'clouds' || overlay == 'solarpower')
			getLatLonInterpolator().then((interpolator) => { updateInterpolator(interpolator, model, overlay) });
		else
			updateInterpolator(null, model, overlay)
	}
	function updateInterpolator(interpolator: any, model: string, overlay: string)
	{
		console.log('updateInterpolator', model, overlay, interpolator);
		_interpolator = interpolator;
		_overlay = overlay;
		if (_meteogramForecast == null || model != _model)
		{
			_model = model;
			updateForecast();
		}
		else
		{
			updateSounding(_meteogramForecast);
		}
	}
  	function updateForecast()
    {
 		console.log('updateForecast:', _model, _loc);
    	if (!isValidLatLonObj(_loc))
    	{
    		updateSounding(null);
    		return;
    	}
    	if (_model == null)
    		_model = store.get('product');

		//getPointForecastData(_model, {lat:_loc.lat, lon:_loc.lon, step:1}).then((pointForecastData) =>{
		//	console.log("pointForecast", pointForecastData);
		//});
 	    getMeteogramForecastData(_model, {lat:_loc.lat, lon:_loc.lon, step:1}).then((meteogramForecast: HttpPayload<MeteogramDataPayload>) => {
        	updateSounding(meteogramForecast);
		}).catch((e) => {
			updateSounding(null);
		});
    }
    function updateSounding(meteogramForecast: any)
    {
		_meteogramForecast = meteogramForecast;
		console.log("updateSounding: ", _hour, _overlay, _loc, _meteogramForecast, _interpolator);

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

        _sounding = new Sounding(_meteogramForecast, _loc, _hour, Qs, cloud);
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
    function format_latlon(x: LatLon | null): string
    {
    	if (x == null) return '';

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

		return latitude + ' / ' + longitude;
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
		return days[dt.getUTCDay()] + ' ' + dt.getUTCDate() + ' - ' + dt.getUTCHours() + ':00';
    }
    function format_number(x: number | null | undefined, n: number): string
    {
    	if (x == null) return '';
		return x.toFixed(n);
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
	.tooltip {
	position: relative;
	display: inline-block;
	}

.tooltip .tooltiptext {
  visibility: hidden;
  width: 200px;
  background-color: black;
  color: #fff;
  text-align: center;
  border-radius: 6px;
  padding: 5px 0;
  
  /* Position the tooltip */
  position: absolute;
  z-index: 1;
  bottom: 100%;
  left: 50%;
  margin-left: -100px;
}

.tooltip:hover .tooltiptext {
  visibility: visible;
}

.tooltipL {
  position: relative;
  display: inline-block;
}

.tooltipL .tooltiptext {
  visibility: hidden;
  width: 200px;
  background-color: black;
  color: #fff;
  text-align: center;
  border-radius: 6px;
  padding: 5px 0;
  
  /* Position the tooltip */
  position: absolute;
  z-index: 1;
  bottom: 100%;
  left: 100%;
  margin-left: -200px;
}

.tooltipL:hover .tooltiptext {
  visibility: visible;
}


.tooltipR {
  position: relative;
  display: inline-block;
}

.tooltipR .tooltiptext {
  visibility: hidden;
  width: 200px;
  background-color: black;
  color: #fff;
  text-align: center;
  border-radius: 6px;
  padding: 5px 0;
  
  /* Position the tooltip */
  position: absolute;
  z-index: 1;
  bottom: 100%;
  right: 100%;
  margin-right: -200px;
}

.tooltipR:hover .tooltiptext {
  visibility: visible;
}


</style>
