<div class="plugin__mobile-header">
    {title}
</div>
<div>
	<div style="color:yellow">SoarCalc: {_model} : {format_time(_hour)}</div>
	{format_latlon(_loc)}
	
<table style="width:100%">
<tr>
<td style=";text-align:left;vertical-align:top">
    T={format_temp(_sounding?.levels[0].T)}
    <br>Tdew={format_temp(_sounding?.levels[0].dewPoint)}
    <br>Tv={format_temp(_sounding?.levels[0].Tv)}
</td>
<td style=";text-align:left;vertical-align:top">
    BL top={format_height(_sounding?.blTop)}
    <br>Cu base={format_height(_sounding?.cuBase)}
    <br>OD base={format_height(_sounding?.odBase)}
</td>
<td style=";text-align:left;vertical-align:top">
    Clouds={format_number(_clouds, 2)}
    <br>Qs={format_number(_Qs, 2)}
    <br>W*={format_number(_sounding?.Wstar, 2)}
    <br>Hcrit = {format_height(_sounding?.Hcrit)}
</td>
</tr>
</table>
</div>


<script lang="ts">
    import { getPointForecastData } from '@windy/fetch';
    import { getMeteogramForecastData } from '@windy/fetch';
    import store from '@windy/store'
    import bcast from '@windy/broadcast';
    import { map } from '@windy/map';
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

    let _sounding = null;
    let _pointForecast = null;
    let _meteogramForecast = null;
    let _interpolator = null;
    let _overlay: string | null = null;
    let _model: string | null = null;
    let _level: string | null = null;
    let _path: string | null = null;
    let _hour: number | null = null;
    let _clouds: number | null = null;
    let _Qs: number | null = null;
    
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
    function showMarker(location: LatLon)
    {
		hideMarker();
		
	    marker = L.marker(location, {
	        draggable: true,
	        icon: draggablePulsatingIcon,
	    }).addTo(map);

	    marker.on('dragend', function (event) {
	        const { lat, lng } = event.target.getLatLng();
	        changeLocation({ lat, lon: lng });
	    });
    }

    // If plugin is opened from RH menu, it is called with location
    // if not, the location param is undefined
    export const onopen = (location?: LatLon) => {
        _loc = null;
        if (isValidLatLonObj(location)) {
        	showMarker(location);
            changeLocation(location);
        }
    };

    onMount(() => {
        singleclick.on(name, onSingleClick);
        broadcast.on('redrawFinished', onRedrawFinished);
    });

    onDestroy(() => {
        singleclick.off(name, onSingleClick);
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
				updateLocation();
			}
			else
			{
		    	updateTimeStep();
			}
		});
	}
	function onParamsChanged(params)
	{
		console.log('onParamsChanged', params);
	}
    function onSingleClick(location: LatLon)
    {
        showMarker(location);
    	changeLocation(location);
    }
    function changeLocation(location: LatLon)
    {
        _loc = location;
        updateLocation();
    }
// **********************************************************
    function updateLocation()
    {
 		console.log('updateLocation:', _model, _loc);
    	if (!isValidLatLonObj(_loc)) return;

 	    getMeteogramForecastData(_model, _loc).then((meteogramForecast) => {
	 	    _meteogramForecast = meteogramForecast;
        	updateTimeStep();
//	    }).catch((reason) => {
//	        console.log('ERROR: ' + reason);
//	 	    _meteogramForecast = null;
		});
    }
    function updateTimeStep()
    {
 		console.log("updateTimeStep: ", _hour, _overlay, _loc, _meteogramForecast);
    	_clouds = null;
    	_Qs = null;
    	if (_interpolator == null || _loc == null) return;
		
   		calculateQs();
   		
    	if (_meteogramForecast == null) return;

        _sounding = new Sounding(_meteogramForecast, _hour, _Qs);
    }
    function calculateQs()
    {
		const values = _interpolator(_loc);
    	console.log("calculateQs: ", _overlay, values);

	    var sunAltitude = SunCalc.getPosition(_hour, _loc.lat, _loc.lon).altitude;
		if (sunAltitude <= 0) sunAltitude = 0;
		const Qs0 = 1000 * Math.sin(sunAltitude);

		if (Array.isArray(values))
		{
			if (_overlay == 'clouds')
			{
			   	_clouds = values[0] / 100;
			   	//_rain = values[1];
				_Qs = (1-_clouds) * Qs0;
			}
			else if (_overlay == 'solarpower')
			{
				_Qs = values[0];
				_clouds = 1 - (_Qs / Qs0);
			}
	    }
    	console.log("/calculateQs:", format_angle(sunAltitude), Qs0, _Qs, _clouds);
    }
// **********************************************************
    function format_height(x: number): string
    {
    	if (x == null) return '';
		return x.toFixed(0);
    }
    function format_temp(x: number): string
    {
    	if (x == null) return '';
		return (x - 273.16).toFixed(2);
    }
    function format_press(x: number): string
    {
    	if (x == null) return '';
		return (x/100).toFixed(2);
    }
    function format_latlon(x: LatLon): string
    {
    	if (!isValidLatLonObj(x)) return '';
		return normalizeLatLon(x.lat) + ', ' + normalizeLatLon(x.lon) ;
    }
    function format_time(d: number): string
    {
    	const days: string[] = ['0', 'Mon', 'Tues', 'Weds', 'Thurs', 'Fri', 'Sat', 'Sun'];
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
