<div>
	<div class="tooltipR" style="color:yellow">{title} v{version}: {_model}
		<span class="tooltiptext">Thermal Soaring parameters as per RASP based on the current forecast model</span>
	</div>
	<br><div class="tooltipR">
		<span style="font-size:10px;vertical-align:top">{format_time(_sounding.hour)}, {format_latlon(_sounding.Loc)}</span>
		<span class="tooltiptext">Time and Location</span>
	</div>
	
	{#if _sounding.status < 0}
	<div>{_sounding.message}</div>
	{/if}

	
	<table style={isMobile ? "width:95%" : "width:100%" }>
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
			<span class="tooltiptext">Cumulous cloud base ({metrics.altitude.metric} amsl) [note: Windy shows this incorrectly in the Sounding Forecast whenever surface pressure > 1000hPa]</span>
		</div>
		<br><div class="tooltip">OD base: 
			{#if _sounding.odPossible}
				{format_height(_sounding.odBase?.gh)}
			{:else}
				<span style="opacity:0.6">{format_height(_sounding.odBase?.gh)}</span>
			{/if}
			<span class="tooltiptext">Overdeveloped / Spreadout cloud base ({metrics.altitude.metric} amsl)</span>
		</div>
		<br><div class="tooltip">BL avg: 
			{format_vector_wind(_sounding.blVx, _sounding.blVy)}
			<span class="tooltiptext">BL average Wind (degrees/{metrics.wind.metric})</span>
		</div>
		<br><div class="tooltip">Shear: 
			{format_wind(_sounding.blShear, 0)}
			<span class="tooltiptext">Wind shear BL top vs surface ({metrics.wind.metric})</span>
		</div>
	</td>
	<td style=";text-align:right;vertical-align:top">
		<div class="tooltipL">Cloud: {format_number(_sounding.cloud, 2)}
			<span class="tooltiptext">Total cloud cover [Clouds layer only]</span>
		</div>
		<br><div class="tooltipL">Qs: {format_number(_sounding.Qs, 0)}
			<span class="tooltiptext">Surface insolation (W/m2) [Clouds layer only]</span>
		</div>
		<br><div class="tooltipL">W*: {format_wind(_sounding.Wstar, 2)}
			<span class="tooltiptext">Thermal updraft velocity ({metrics.wind.metric}) [Clouds layer only]</span>
		</div>
		<br><div class="tooltipL">Hcrit: 
			{#if _sounding.Hcrit == _sounding.surface?.gh}
				<span style="opacity:0.6">{format_height(_sounding.Hcrit)}</span>
			{:else}
				{format_height(_sounding.Hcrit)}
			{/if}
			<span class="tooltiptext">Height at which updraft falls below {format_wind(0.9, 2)} {metrics.wind.metric} ({metrics.altitude.metric} amsl) [Clouds layer only]</span>
		</div>
		<br><div class="tooltipL">B/S: {format_number(_sounding.Ri, 2)}
			<span class="tooltiptext">Bouyancy/Shear ratio [Clouds layer only]</span>
		</div>
	</td>
	</tr>
	</table>
	<div class="tooltipR">
		<span style="color:yellow;font-size:10px;vertical-align:top">{isMobile ? 'Tap' : 'Hover'} for descriptions</span>
		<span class="tooltiptext">{isMobile ? 'Tap' : 'Hover'} individual parameters to see their descriptions</span>
	</div>
</div>

<script lang="ts">
	import { isMobile } from '@windy/rootScope';
	import { getMeteogramForecastData } from '@windy/fetch';
    import store from '@windy/store'
    import { map } from '@windy/map';
    import { isValidLatLonObj } from '@windy/utils';
    import { singleclick } from '@windy/singleclick';
    import metrics from '@windy/metrics';
    import { onDestroy, onMount } from 'svelte';
    import config from './pluginConfig';
    import type { LatLon, MeteogramDataPayload } from '@windy/interfaces.d';
    import { getLatLonInterpolator } from '@windy/interpolator';
	import broadcast from '@windy/broadcast';
	import { Sounding } from './SoarCalc';
    import { HttpPayload } from '@windycom/plugin-devtools/types/client/http';
	import plugins from '@windy/plugins';

    //import bcast from '@windy/broadcast';
	
    let marker: L.Marker | null = null;
    let _loc: LatLon;

    let _sounding: Sounding = new Sounding(null, null, null, null, null);
    let _meteogramForecast: any | null = null;
    let _interpolator: any = null;
    let _overlay: string | null = null;
    let _model: string | null = null;
   
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
		if(isMobile)
		{
			// without this the small window on mobile UI inherits pointerEvents = none;
			const thisPlugin = plugins['windy-plugin-soarcalc'];
			thisPlugin.window.node.style.pointerEvents = "initial";
		}

		broadcast.emit('rqstClose', 'sounding');
		broadcast.emit('rqstClose', 'detail');
        if (isValidLatLonObj(location)) {
       		_loc = location;
        	showMarker();
        }
        updateInterpolator();
	};

    onMount(() => {
		console.log("onMount")
        broadcast.on('redrawFinished', onRedrawFinished);
		broadcast.on('rqstOpen', onRqstOpen);
        singleclick.on(name, onSingleClick);
		singleclick.on('sounding', onSingleClick);
		singleclick.on('detail', onSingleClick);

	});

    onDestroy(() => {
        hideMarker();
        broadcast.off('redrawFinished', onRedrawFinished);
		broadcast.off('rqstOpen', onRqstOpen);
        singleclick.off(name, onSingleClick);
		singleclick.off('sounding', onSingleClick);
		singleclick.off('detail', onSingleClick);
    });
	function onSingleClick(location: LatLon)
    {
    	console.log("onSingleClick:", location, store.get('product'), store.get('overlay'));
         _loc = location;
        showMarker();
        updateForecast();
    }
	function onRqstOpen(plugin: any, location: LatLon)
    {
    	console.log("onRqstOpen:", plugin, location);
        if ((plugin == 'detail' || plugin == 'sounding' || plugin == 'airport' || plugin == 'picker') && isValidLatLonObj(location)) {
			onSingleClick(location);
		}
    }
  
	function onRedrawFinished(params: any)
	{
		console.log('onRedrawFinished', params, 'store.timestamp=', store.get('timestamp'));
		_interpolator = null;
		updateInterpolator();
	}
	function timeout(p: Promise<any>, ms: number): Promise<any>
	{
		// return a race between the passed in promise and one that resolves with null after specified number of milliseconds
		return Promise.race([p, new Promise((resolve) => {setTimeout(() => resolve(null), ms)})]);
	}
	function updateInterpolator()
	{
		var overlay = store.get('overlay');
		console.log('updateInterpolator', overlay);
		if (overlay == 'clouds' || overlay == 'solarpower')
		{
			timeout(getLatLonInterpolator(), 1000).then((interpolator) => {
				setInterpolator(interpolator, overlay);
			});
		}
		else
			setInterpolator(null, overlay)
	}
	function setInterpolator(interpolator: any, overlay: string)
	{
		var model = store.get('product');
		console.log('setInterpolator', interpolator != null, model, overlay);
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

 	    getMeteogramForecastData(_model, {lat:_loc.lat, lon:_loc.lon, step:1}).then((meteogramForecast: HttpPayload<MeteogramDataPayload>) => {
        	updateSounding(meteogramForecast);
		}).catch((e) => {
			updateSounding(null);
		});
    }
    function updateSounding(meteogramForecast: any)
    {
		_meteogramForecast = meteogramForecast;
		console.log("updateSounding: ", _overlay, _loc, _meteogramForecast, _interpolator);

    	var timestamp: number | null = store.get('timestamp');
		var cloud: number | null = null;
		var Qs: number | null = null;
    	if (_interpolator != null && isValidLatLonObj(_loc))
    	{
			const values = _interpolator(_loc);
			if (Array.isArray(values))
			{
				if (_overlay == 'clouds')
				{
				   	cloud = values[0] / 100;
				   	//rain = values[1];
				}
				else if (_overlay == 'solarpower')
				{
					Qs = values[0];
				}
			}
    	}
        _sounding = new Sounding(_meteogramForecast, _loc, timestamp, Qs, cloud);
    }
// **********************************************************
    function format_height(x: number | null | undefined): string
    {
    	if (x == null) return '##';
    	return metrics.altitude.convertNumber(x, 0);
    }
    function format_temp(x: number | null | undefined): string
    {
    	if (x == null) return '##';
    	return metrics.temp.convertNumber(x, 1).toFixed(1);
    }
    function format_wind(x: number | null | undefined, n: number): string
    {
    	if (x == null) return '##';
		return metrics.wind.convertNumber(x, n);
    }
    function format_vector_wind(x: number | null | undefined, y: number | null | undefined): string
    {
    	if (x == null || y == null) return '##/##';
		const w: number = Math.sqrt(x*x + y*y);
		var a: number = 270 - (Math.atan2(y, x) * 180 / Math.PI);
		if (a < 0) a += 360;

		return Math.round(a) + "/" + metrics.wind.convertNumber(w, 0);
    }
    function format_latlon(x: LatLon | null): string
    {
    	if (x == null) return '##, ##';

		var latitude: string;
    	var longitude: string;
    	if (x.lat >= 0)
    		latitude = 'N' + toDegreesAndDecimalMinutes(x.lat)
    	else
    		latitude =  'S' + toDegreesAndDecimalMinutes(Math.abs(x.lat))

    	if (x.lon >= 0)
    		longitude = 'E' + toDegreesAndDecimalMinutes(x.lon)
    	else
    		longitude = 'W' + toDegreesAndDecimalMinutes(Math.abs(x.lon))

		return latitude + ', ' + longitude;
    }
    function toDegreesAndDecimalMinutes(x: number): string
    {
		const degrees: number = Math.floor(x);
		const minutes: number = (x - degrees) * 60;
		return degrees + ' ' + minutes.toFixed(3);
    }
    function format_time(d: number | null | undefined): string
    {
    	if (d == null) return '##';
    	const days: string[] = ['Sun', 'Mon', 'Tues', 'Weds', 'Thurs', 'Fri', 'Sat'];
    	const dt = new Date(d);
		//return days[dt.getUTCDay()] + ' ' + dt.getUTCDate() + ' - ' + dt.getUTCHours() + ':00';
		return days[dt.getDay()] + ' ' + dt.getDate() + ' - ' + dt.getHours() + ':00';
    }
    function format_number(x: number | null | undefined, n: number): string
    {
    	if (x == null) return '##';
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
