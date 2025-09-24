<div>
	<div class="tooltipR" style="color:yellow">{title} v{version}: {_sounding.model} {format_refTime(_sounding.refTime)}
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
   	import type { LatLon, MeteogramDataPayload } from '@windy/interfaces.d';
	// import { getPointForecastData } from '@windy/fetch';
   	// import type { WeatherDataPayload } from '@windy/interfaces.d';
    import store from '@windy/store'
    import { map } from '@windy/map';
    import { isValidLatLonObj } from '@windy/utils';
    import { singleclick } from '@windy/singleclick';
    import metrics from '@windy/metrics';
    import { onDestroy, onMount } from 'svelte';
    import config from './pluginConfig';
     import { getLatLonInterpolator } from '@windy/interpolator';
	import broadcast from '@windy/broadcast';
	import { Sounding } from './SoarCalc';
    import { HttpPayload } from '@windycom/plugin-devtools/types/client/http';
	import plugins from '@windy/plugins';
    import { MapCoordinates } from '@windy/client/d.ts.files/dataSpecifications';
	
    let marker: L.Marker | null = null;
    let _loc: LatLon;

    let _sounding: Sounding = new Sounding(null, null, null, null, null, null, null);
    let _meteogramForecast: any = null;
    let _interpolator: any = null;

	let _timestamp: number = 0;
	let	_model: string | null = null;
	let	_overlay: string | null = null;
	let	_hour: number = 0;
	let _latitude: number = 0;
	let _longitude: number = 0;
	let _mapLatitude: number = 0;
	let _mapLongitude: number = 0;
	let _mapZoom: number = 0;

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
    function showMarker(location: LatLon)
    {
		_loc = location;
		hideMarker();
		
	    marker = L.marker({lat:location.lat, lng:location.lon}, {
	        draggable: true,
	        icon: draggablePulsatingIcon,
	    }).addTo(map);
	    
	    marker.on('dragend', function (event) {
	        const { lat, lng } = event.target.getLatLng();
	        update('dragend', { lat, lon: lng });
	    });
    }

    // If plugin is opened from RH menu, it is called with location
    // if not, the location param is undefined
    export const onopen = (location?: LatLon) => {
		console.log('onOpen', location);
		if(isMobile)
		{
			// without this the small window on mobile UI inherits pointerEvents = none;
			const thisPlugin = plugins['windy-plugin-soarcalc'];
			thisPlugin.window.node.style.pointerEvents = "initial";
		}

		// first discover if ukv is available at the desired location and if so select it
		console.log(store.get('product'));
		var loc: LatLon | null = null;
        if (location != null && isValidLatLonObj(location))
			loc = location;
		else
			loc = store.get('mapCoords');

		if (loc == null)
			onOpen2(location);
		else
		{
			getMeteogramForecastData('ukv', {lat:loc.lat, lon:loc.lon, step:1}).then((meteogramForecast) => {
				console.log('ukv available');
				store.set('product', 'ukv');
				onOpen2(location);
			}).catch((e) => {
				console.log('ukv not available');
				onOpen2(location);
			});
		}
	}
	function onOpen2(location: LatLon | undefined)
	{
		console.log('onOpen2', location);
		broadcast.emit('rqstClose', 'sounding');
		broadcast.emit('rqstClose', 'detail');

		store.set('overlay', 'clouds');

		console.log('mapCoords:', store.get('mapCoords'));
		console.log('availableProducts:', store.get('availProducts'));
		
		// if location is given we use it and centre the map on that location
		// otherwise we set the location to the centre of the map

		const mapCoords: MapCoordinates | null = store.get('mapCoords');
        if (location != null && isValidLatLonObj(location) && (mapCoords?.lat != location.lat || mapCoords?.lon != location.lon))
		{
			// map.setView will eventually trigger an onRedrawFinished() so no need to update here
			showMarker(location);
			map.setView({lat: location.lat, lng: location.lon}, 8);
		}
		else
			update('onOpen', mapCoords);
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
		update('onSingleClick', location);
    }
	function onRqstOpen(plugin: any, location: LatLon)
    {
        if ((plugin == 'detail' || plugin == 'sounding' || plugin == 'airport' || plugin == 'picker') && isValidLatLonObj(location)) {
			update('onRqstOpen', location);
		}
    }
  
	function onRedrawFinished(params: any)
	{
		// still need this to avoid conflict with internal use of getLatLonInterpolator()
		pause(200).then(() => {update('onRedrawFinished', null)});
	}

	function update(tag: string, location: LatLon | null)
	{
		const model = store.get('product');
		const overlay = store.get('overlay');
		const timestamp: number | null = store.get('timestamp');
		const mapCoords = store.get('mapCoords');

		// the slider shows the timestamp that it stores truncated to the hour and it is this truncated (not rounded) value that corresponds to the map / forecast point
		const hour = 3600000 * Math.trunc(timestamp/3600000);

		const ts: number = new Date().getTime();

		if (location != null)
			showMarker(location);

		console.log('update:', tag, ts, model, overlay, hoursAndMinutes(hour), _loc?.lat, _loc?.lon);

		// interpolator is also invalidated by zooming or panning map
		var valid: boolean = mapCoords?.lat == _mapLatitude && mapCoords?.lon == _mapLongitude && mapCoords?.zoom == _mapZoom;

		// onRedrawFinished gets fired twice when stepping though hours in day so add this code to avoid wasting resource
		// if we were brave enough we could remove the timeout
		if (ts < _timestamp + 60000 && valid && model == _model && overlay == _overlay && hour == _hour && _loc?.lat == _latitude && _loc?.lon == _longitude)
		{
			console.log('duplicate');
			return;
		}

		_timestamp = ts;
		_model = model;
		_overlay = overlay;
		_hour = hour;
		_latitude = _loc?.lat;
		_longitude = _loc?.lon;
		_mapLatitude = mapCoords?.lat!;
		_mapLongitude = mapCoords?.lon!;
		_mapZoom = mapCoords?.zoom!;

		updateMeteogramForecast(model, _loc).then((meteogramForecast) => {
			console.log('updateMeteogramForecast.then', new Date().getTime(), meteogramForecast != null);
			_meteogramForecast = meteogramForecast;

			updateInterpolator(model, overlay, hour, valid).then((interpolator) => {
				console.log('updateInterpolator.then', new Date().getTime(), interpolator != null);
				_interpolator = interpolator;

				var cloud: number | null = null;
				var Qs: number | null = null;
				if ((overlay == 'clouds' || overlay == 'solarpower') && _interpolator != null && isValidLatLonObj(_loc))
				{
					const values = _interpolator(_loc);
					if (Array.isArray(values))
					{
						if (overlay == 'clouds')
						{
							cloud = values[0] / 100;
							//rain = values[1];
						}
						else if (overlay == 'solarpower')
						{
							Qs = values[0];
						}
					}
				}
				_sounding = new Sounding(_meteogramForecast, model, _loc, hour, overlay, Qs, cloud);
			}).catch((e) => {
				console.log('updateInterpolator.catch', e.message);
				_interpolator = null;
				_sounding = new Sounding(_meteogramForecast, model, _loc, hour, overlay, null, null);
			});
		}).catch((e) => {
			console.log('updateMeteogramForecast.catch', e.message);
			_meteogramForecast = null;
			_sounding = new Sounding(_meteogramForecast, model, _loc, hour, overlay, null, null);
		});
	}

	function updateMeteogramForecast(model: string | null, loc: LatLon | null): Promise<HttpPayload<MeteogramDataPayload> | null>
	{
		if (model == null || loc == null)
			return new Promise((resolve) => {resolve(null)});

		if (_meteogramForecast != null && model == _sounding.model && loc.lat == _sounding.Loc?.lat && loc.lon == _sounding.Loc?.lon)
			return new Promise((resolve) => {resolve(_meteogramForecast)});
 	    	
		console.log('getMeteogramForecastData()');
		return getMeteogramForecastData(model, {lat:loc.lat, lon:loc.lon, step:1});
	}
	// function updatePointForecast(model: string | null, loc: LatLon | null): Promise<HttpPayload<WeatherDataPayload> | null>
	// {
	//	// PointForecast contains nothing useful that is not already included in MeteogramForecast
	// 	if (model == null || loc == null)
	// 		return new Promise((resolve) => {resolve(null)});

	// 	console.log('getPointForecastData()');
	// 	return getPointForecastData(model, {lat:loc.lat, lon:loc.lon, step:1});
	// }

	function updateInterpolator(model: string | null, overlay: string | null, hour: number, valid: boolean): Promise<any>
	{
		//console.log('updateInterpolator:', model, _sounding.model, overlay, _sounding.overlay, hour, _sounding.hour);
		if (model == null || (overlay != 'clouds' && overlay != 'solarpower'))
			return new Promise((resolve) => {resolve(null)});

		if (_interpolator != null && valid && model == _sounding.model && overlay == _sounding.overlay && hour == _sounding.hour)
			return new Promise((resolve) => {resolve(_interpolator)});

		console.log('getLatLonInterpolator()');
		return Promise.race([getLatLonInterpolator(), pause(1000)]);

		// pause(120).then(() => {
		// 	Promise.race([getLatLonInterpolator(), pause(1000)]).then((interpolator) => {
		// 		if (interpolator != null)
		// 			setInterpolator(interpolator);
		// 		else
		// 		{
		// 			// retry once after first timeout.
		// 			console.log('retrying getLatLonInterpolator()');
		// 			Promise.race([getLatLonInterpolator(), pause(1000)]).then((interpolator) => {
		// 				setInterpolator(interpolator);
		// 			});
		// 		}
		// 	});
		// });

	}
	function pause(ms: number): Promise<any>
	{
		// return a promise that resolves with null after specified number of milliseconds
		return new Promise((resolve) => {setTimeout(() => resolve(null), ms)});
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
		else if (a > 360) a -= 360;

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
    function format_refTime(t: number | null | undefined): string
    {
    	if (t == null) return '(##)';
    	const hour = new Date(t).getUTCHours();
		if (hour < 10)
			return '(0' + hour + 'Z)';
		else
			return '(' + hour + 'Z)';
    }
    function format_number(x: number | null | undefined, n: number): string
    {
    	if (x == null) return '##';
		return x.toFixed(n);
    }
	function hoursAndMinutes(t: number): string
	{
			const d = new Date(t);
			return d.getHours() + ":" + d.getMinutes();
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
