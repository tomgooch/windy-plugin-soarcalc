import type { ExternalPluginConfig } from '@windy/interfaces';

const config: ExternalPluginConfig = {
    name: 'windy-plugin-soarcalc',
    version: '0.1.5',
    title: 'SoarCalc',
    icon: '🌤️',
    description: 'Displays Soaring parameters for any location on map.',
    author: '@tomA27',
    repository: 'https://github.com/tomgooch/windy-plugin-soarcalc',
    desktopUI: 'embedded',
    mobileUI: 'fullscreen',
    desktopWidth: 400,

    // Link to this plugin will be additional add to RH button context menu
    // which will enable to open plugin from context menu, with lat, lon
    // parameters passed to onopen method
    addToContextmenu: true,

    // This plugin can be opened from URL
    // https://www.windy.com/plugin/route-path/:lat/:lon
    routerPath: '/soarcalc/:lat?/:lon?',

    // Whenever user clicks on map and plugin i opened,
    // singleclick events is emitted with name of this plugin
    listenToSingleclick: true,
    
    private: true,
};

export default config;
