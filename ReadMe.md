---
theme : jekyll-theme-minimal
---
# SoarCalc plugin for Windy.com

SoarCalc is a plugin for Windy.com that calculates and displays thermal soaring
parameters in, as far as possible, exactly the same way as RASP.

## Contents

- [Installation](#installation)

- [Getting Started](#getting-started)

- [Change Log](#change-log)

- [Discussion](#discussion)

---

## Installation

The installation process is as follows (note that this differs for desktop vs mobile devices)...

### Desktop

1. Open [Windy.com](https://www.windy.com) within a browser on a laptop/PC

2. Open the menu

3. Select “Install Windy Plugin”, then select "SoarCalc" from the list of available plugins, then "Install plugin", then "Open plugin".

4. SoarCalc is now installed and can be opened either from the main menu or the context menu (right mouse on the map).  Alternately, it may be opened directly by navigating to <https://windy.com/plugin/soarcalc>.

### Mobile

Note:  Windy plugins including SoarCalc are not compatible with the Windy mobile App but SoarCalc functions well within Chrome etc on mobile devices.

1. Open Chrome or other browser on your mobile device.

2. Navigate to <https://windy.com/plugin/soarcalc>  (do not go to windy.com as that will redirect you to the App which you do not want)

3. If SoarCalc is not yet installed you will be re-directed to the "Windy Plugins" menu page. Select "SoarCalc" from the list of available plugins, then select "Install plugin", then "Open plugin".

4. If SoarCalc is already installed then navigating to <https://windy.com/plugin/soarcalc> will cause Windy to open with the SoarCalc plugin already active.

5. It will always be necessary to use <https://windy.com/plugin/soarcalc> so you may want to create a shortcut to that.

NOTE: Ignore the button inviting you to "Download App".

### Pre-Release Versions

Pre-release versions are sometimes made available for test / user feedback purposes.  To install a pre-release version for which you have been given the url...

1. Go to the Windy Plugins menu page either by selecting "Install Windy Plugin" within the Windy.com desktop main menu or by navigating to <https://windy.com/plugins>

2. Select “Load plugin directly from URL”

3. Paste this string after the url already present in the input box:

          12216047/windy-plugin-soarcalc/1.2.19/plugin.min.js

4. Press "install untrusted plugin" and SoarCalc will be available on the main menu.

NOTE: selecting SoarCalc within the "Windy Plugins" menu also gives you access to a link to the github repository for this plugin including this document (ReadMe.md).

## Getting Started

Tooltips give a description of all the parameters displayed by SoarCalc.  Some of the parameters are only available in the "Clouds" or "SolarPower" overlays.

Windy.com opens by default in the “Wind” layer. SoarCalc works better in the “clouds” layer and so it switches over to that automatically when opened.

On opening the location is always set either to the given coordinates from the url or to the centre of the map area and if available at that location the 'ukv' model is selected.

One of the really great things about Windy.com is that it offers you a range of the best weather models available.  Windy defaults to the "ECMWF" (European Centre for Medium Range Weather Forecasting) model which is a great medium resolution global model.  However, in most regions of the world there are better high resolution models available.  In the UK we have the "UKV" model from the Met Office.  You will find that these give you a much better view of the soaring weather so please consider using these.

If you are a Windy "Premium" user you will see the data with 1 hour time steps which is a considerably better experience than the default 3 hour steps seen by non-premium users.

To gain a better understanding of the parameters that are being presented please take a little time to read the [Discussion](#discussion) section of this document.

---

## Change Log

### 1.2.18

- On opening, if location is given in url map is moved so that location marker is central, if not then location is set to centre of map.
- Select the ukv model on opening if it is available.
- Include forecast reference time in title.
- Improve exception handling round getMeteogramForecastData().

### 1.2.15

This release wraps up a number of important issues.

- Fixed problem with cloud cover data sometimes being missing when stepping though the hours of the day.
- Fixed problem with synchronization with the time shown on the slider.
- Updating of soaring parameters has been optimized. 
- Tooltips now work properly on mobile.
- The "clouds" layer is automatically selected when the SoarCalc is opened.

### 1.0.11

The main purpose of this release is to make the plug-in work with the most recent update of Windy.com (August 2025).  Also...

- Boundary Layer Average Wind parameter has been added.
- Issues with time shown in plug-in being out of step with that shown on the slider are resolved.
- Timeouts from getLatLongInterpolator() are handled gracefully.  The parameters are now all updated properly except that the values in the rightmost "cloud" column show as ## in this circumstance rather than continuing to show old data.

### 1.0.6

This is the first publicly available version of this plugin.  Changes are mainly limited to documentation / tooltip texts etc.

- bug causing "cloud ratio" to go negative has been fixed.
- current location now also follows selection of airports and the weather picker.

### 1.0.2

- 'detail' and 'sounding' plugins are closed on opening soarcalc (so that soarcalc will be able to see their onSingleClick events if they are reopened).
- on opening 'detail' or 'sounding' plugins the current location for soarcalc is updated.

### 1.0.1

This version remains a private release but can be seen as the first candidate for public release.
Important improvements from earlier private releases include...

- Support for mobile devices
- Descriptions of all parameters available as tooltips
- Meaningful error messages in particular when there is no location selected on the map or the selected model does not provide the required data.

---

## Discussion

### Abstract

Windy.com is a very good general weather forecast site that shows data from some of the best weather models available notably including
UKV from the UK Met Office and similar high resolution models worldwide.

SoarCalc is a plugin for Windy.com that calculates and displays thermal soaring
related parameters calculated in the same way as RASP.

### Introduction

This document is written from the point of view of sailplane pilots in the UK but it will be equally applicable to all forms of soaring flight anywhere in the world where high resolution weather models are available.

For the upcoming day or two "UKV" is probably the best forecast model available to us in the UK. As such it is already an important resource for planning any cross-country task.  However, it is inconvenient that the soaring specific parameters are not immediately available as they are on the soaring forecast sites (RASP, SkySight, TopMeteo etc.). Personally, I always check the soaring forecasts against UKV and if they significantly disagree then this is a good indication that they are not to be trusted. If they do agree, then, of course they do provide a better user experience. But the soaring forecasts all have their problems. I shall take the case of RASP because...

1. The forecast analysis and range of parameters that it presents are sound and well documented.
2. Its author, Dr. John W. (Jack) Glendening (reference 1), has been open about the origin of the parameters that are presented.
3. Experience suggests that, on days where the models (including GFS) are largely in agreement and there is not much spreadout / over-development, it is still probably as good as anything we have.

However RASP does have some serious issues...

1. It still uses GFS and only GFS which is no longer the best forecast available for the UK
2. It is updated infrequently. Usually even in the morning we see a forecast for the current day that is already 12 hours old.
3. It does not deal with cloud amounts very well. There are a significant number of days in the year when it predicts virtually no cloud cover and hence good (5*) conditions over large areas at variance with all other models / forecasting sites and with reality.

So the motivation to develop a plugin for Windy.com is simple. To make the RASP parameters available within Windy.com using the data from "UKV" or any of the other models that are available.

One thing that one learns very quickly is that there is nothing exact about boundary layer meteorology.  There are multiple reasonable interpretations and assumptions some being more reasonable and useful that others.  For this reason I have endeavoured to calculate the soaring parameters in, as far as possible, exactly the same way as RASP making the same assumptions and approximations following reference 1.  This way they should be just as reasonable and useful as RASP with which many of us are already familiar.

Unfortunately however, it is not possible to compare the values output from SoarCalc directly with those output by RASP because they do not start with the same base data.

### Methodology

Windy.com supports a "Plugin" mechanism allowing the development of
JavaScript code to display additional information within their browser
based user interface.

Within the plugin code one can get hold of the forecast information, do
some calculations and display information on the screen. It is
relatively easy to look at the forecast data forwards along a timeline
for a fixed location but less easy to look over a wide area at a fixed
point in time. For this reason we are limited to point forecasts rather
than a layer on a map - that would require a deeper integration with
Windy.com.

I have not made any attempt to calculate or show parameters that are already available and displayed very nicely directly in Windy.com.

Some of the parameters are available when viewing any map layer in Windy but the full functionality is available only when viewing the "Clouds" or "Solar power" layers. This is because we need an estimate of the incident solar radiation in order to calculate the thermal updraft velocity and derived quantities.

### Parameters

A brief description of the parameters presented by SoarCalc is given by means of "Tool Tips".  A more detailed description of each parameter is given here.

Values are given in the units selected in the Windy.com "Settings"

I strongly recommend reading the notes published by Dr Jack Glendening
describing the RASP parameters [BLIPMAP Prediction Parameters and Description](http://www.drjack.info/blip/INFO/parameters.html)

#### T / Tdew - Surface temperature / dew point

These are taken directly from the forecast model data and are self explanatory except to note that "surface" refers to the model elevation not to the actual elevation.  If the model elevation differs significantly from the actual elevation then these values will differ correspondingly.

#### Elev / ElevA - Surface Elevation Model / Actual

The model surface elevation "Elev" is used in all calculations.  The actual elevation "ElevA" is given only as a guide.  If it differs greatly from "Elev" that is a sign that significant geographic features may not be "seen" at the resolution of the current model.

#### BL top - Boundary Layer Top

Following RASP this is defined to be the level at which the buoyancy of a parcel of air
 originating at the surface would fall to zero with respect to the surrounding air in the absence of condensation.
 Clearly, this is only "correct" in the case of dry thermals / blue conditions but this
 is not unreasonable because we are interested primarily in what is going on either below
 the cumulous cloud base or up to the top of blue thermals.  A treatment of what is going on within
 convective cloud is complex and of little practical use in this context except to note that
 "cloud suck" is a real effect and thermal updraft strength is increased in the presence of
 substantial convective cloud.

 The calculation of this quantity starts with the calculation of the virtual (density) temperature at the
 surface and at every level in the data given to us by the model in order to allow for the fact that moist air is less dense than dry air.
 The Virtual temperature ( $T_{v}$ ) of a moist air parcel is the temperature at which a dry air parcel
 would have the same density at the same pressure.  Water vapour has a lower density than dry air and so
  $T_{v}$ is greater than the actual air temperature usually by up to 2C.  As the parcel ascends the environmental
  air through which it passes typically becomes less moist and so the significance of using $T_{v}$ rather than $T$ increases.
  Thus the value of BL top that we arrive at will usually be a little higher than would be obtained by the intersection of the
  dry adiabatic with the environmental temperature on the forecast sounding.

#### Cu base - Cumulous Cloud Base

This parameter is also known as "LCL" the Lifting Condensation Level.  If below the boundary layer top then
Cumulous clouds are likely to be present otherwise not but it is still a valid parameter useful for the prediction of orographic cloud for example.  If Cu base is above BL top then this parameter is greyed out.  Cumulous
cloud formation becomes increasingly less likely as the difference between Cu base and BL top increases.  If Cu base is below
BL top then Cu cloud formation is likely and the size and likelihood of Cu clouds becomes greater as the difference increases.

It is defined as the level to which a parcel of air from the surface must be raised before it is cooled to saturation
point and condensation takes place.  On a tephigram sounding it is the intersection of the line of constant mixing ratio
from the surface dew point and the dry adiabatic from the surface temperature.

#### OD base - Overcast Development / Spreadout Cloud Base

Following RASP, this is the condensation level of a parcel of air having the boundary layer average mixing ratio.  If below BL top
then widespread convective cloud formation is likely.  If above BL top then this parameter is shown greyed out.

#### Cloud - Total Cloud Cover

The fractional cloud cover (dimensionless ratio ranging from 0 to 1).  This is taken
directly from the "Clouds" map layer in Windy. When viewing the UKV model this is probably the best estimate of cloud cover that we have
available in the UK.  Together with the "Solar Altitude" and the known perpendicular solar flux in the absence of cloud/moisture in the atmosphere, this is used to calculate the surface insolation "Qs" see below.

In the case of the "Solar Power" layer this value is "reverse engineered" from the given value of Qs.

In other map layers in Windy.com this parameter is not currently available.

#### Qs - Surface Insolation

The surface insolation / solar power arriving per unit area of the Earth's surface.  (Note: This is always shown in Watts per square meter as no suitable configurable setting is available.)

The value show is either that calculated from the cloud cover (see above) or taken directly from Windy.com if viewing the "Solar Power" layer.  Note that agreement between the values from these two sources is not perfect.

#### W* - Thermal updraft velocity

W* is known as the Deardorff velocity (reference 5).  It is the characteristic thermal updraft
velocity which is definitely not to say that all parts of a thermal at all altitudes will be rising
at this velocity.  Even in an idealized thermal the actual updraft velocity will vary with both altitude
and distance from the centre of the thermal.  However, as explained in reference 1 and by practical experience
this is known to be a useful measure.

$W^* = (g z Q_{ov}/\bar{T})^{1/3}$

where...

$g$ = acceleration due to gravity

$z$ = boundary layer depth (BL top - Elev)

$\bar{T}$ = average absolute temperature taken to be 15C / 288K

$Q_{ov}$ = surface virtual potential temperature flux which can be derived from $Q_{s}$ and is very close to...

$Q_{ov} = 0.75 Q_s / (\rho C_p)$

where $\rho$ is the surface density of air which we take as 1.21 Kg/m3 and $C_p$ is the specific heat capacity at constant pressure of air taken as 1005 J/kgK

The derivation of this is given in Appendix 1.  There is plenty of scope for discussion about
the "best" value to use for this constant.  I have elected to follow the author of (reference 2) who gives a useful
overview of the method of calculation.  I believe that these are similar to those used by RASP. But
note that the resulting value of $W^*$ is surprisingly insensitive to this value depending only on it's cube root.

Note: to get to the expected climb rate of a glider you must, of course, subtract the descent rate of the
glider whilst turning.  Typically about 0.9m/s or 1.75kts.

#### BL avg - Boundary Layer Average Wind

The vector average wind between surface and BL top.

#### BL Shear - Boundary Layer Wind Shear

The modulus of vector wind difference between surface and BL top.

#### B/S - Buoyancy/Shear ratio

The Bulk Richardson number = ${W^*}^2/(BL shear)^2$ is a dimensionless quantity representing the ratio of "buoyant production of turbulent kinetic energy" to the "shear production of turbulent kinetic energy".  Larger values of the quantity indicate less broken thermals, smaller quantities indicate more broken thermals.

It is my belief that RASP presents this same number but as a percentage and talks about values above 5(%) being useful to sailplane pilots.  However, here, it is presented directly so this corresponds to a value of 0.05.

NOTE: if anyone can confirm or refute my assumption and that RASP is using some other definition of this quantity I would be very pleased to hear about it.

NOTE 2: Even within this definition there is plenty of room for a factor of 4 difference simply by taking the shear value at half the BL height which is something like where the maximum updraft velocity will occur.

#### Hcrit - Height at which updraft falls below 0.9m/s (1.75kts)

Empirically, as glider pilots, we know that thermal strength initially increases with altitude, remains roughly the same for
a range of altitudes and then falls slowly back to zero as we approach the boundary layer top.  Therefore it is of interest
to estimate the critical altitude at which the thermal strength is expected to fall to the descent rate of the glider.

Lechlow and Stephens (reference 3) propose the following equation for the thermal updraft strength at a given altitude...

$W = z^{1/3}(1 - 1.1z)$

where...

$z$ = height above ground / BL thickness

It must be noted that there is not much physical justification for this, it is merely an empirical fit to rather old experimental data observed in thermals over the sea.

RASP appears to use a version of this modified such that the maximum value of $W$ is approximately equal to $W^*$ which does seem to fit the thermals we are used to over land rather better.

$W = 2.2z^{1/3}(1 - 1.1z)$

We use this equation we find the altitude at which the updraft velocity falls to 0.9m/s or 1.75kts
in order to follow RASP as closely as possible.

### Further Comments

It is useful to display the SoarCalc plugin in conjunction with the Windy.com "Sounding forecast" pane and I would recommend that you to do this.  As all calculations
are based on the same data it would indeed be natural for the SoarCalc parameters to be amalgamated with the
"Sounding forecast" pane.  Indeed LCL/Cu base is already shown on the "Sounding forecast" pane BUT there is a problem:
Currently LCL shown in the "Sounding forecast" pane is incorrect whenever the surface pressure is higher than 1000hPa.

So PLEASE do not look at the discrepancy and assume that SoarCalc is incorrect.  This is not the case.

It remains to use the plugin and gain practical experience of its usefulness.  Unfortunately, the winter is currently upon
us in the northern hemisphere.  I can only try to draw experience from comparison with RASP in Australia, New Zealand and South Africa.
The usefulness of this is limited by the facts that high resolution models are not available for these locations and
I am unable to compare with the actual soaring conditions.  However, the numbers do seem to correspond reasonably well. (Note: since writing the above the 1.5km resolution "ACCESS" models have become available in Australia)

### Further Development

It would be useful to estimate the Solar Insolation more thoroughly involving the cloud opacity/thickness as well as the cloud cover.  The estimate of Thermal Updraft velocity ($W^*$) would then be available in all layers.  However, it is far from clear how much improvement this might make to the forecast value of $W^*$ given the other assumptions and approximations involved.

### Appendix 1 - Derivation of Virtual Potential Temperature Flux

The virtual potential temperature flux $Q_{ov}$ can be calculated from the incident solar radiation
$Q_s$ as follows.

Only a part of the incident radiation flux is available to heat the atmosphere...

$\tilde{Q}_h = \beta(Q_s - Q_g)/(1 + \beta)$

where...
$\beta$ is an the Bowen ratio of sensible to latent heat flux.  Following reference 2 we take to be
 5 said to correspond to "semi-arid" land but this says nothing more than that 5/6 of the incident
  radiation is reflected rather than absorbed.

$Q_g$ is the heat flux into the ground which again following reference 2 we take to be $0.1Q_s$

Both these factors will obviously vary with the nature of the ground.  We all know that thermals are
stronger over land than water and stronger over bare rock/concrete than over forests but we stick to
this value as some kind of average.

So this reduces to...
$\tilde{Q}_h = 0.75Q_s$

Expressing this in its kinematic form we have...
${Q}_h = \tilde{Q}_h / (\rho C_p)$

where $\rho$ is the surface density of air which we take as 1.21 Kg/m3 and $C_p$ is the specific heat capacity at constant pressure of air taken as 1004.67 J/kgK

We must now convert this to the kinematic virtual (density) sensible heat flux

$Q_{ov} = Q_h ( 1 + ((R_v - R_d) / R_d) U)$

Where $R_v$ is the gas constant for water vapour (461 J/kgK), $R_d$ is the gas constant for dry air (287 J/kgK)
 and $U$ is the density mixing ration of water vapour to dry air at the surface which can be obtained from the
 temperature, pressure and relative humidity given by the forecast model.  However, the mixing ratio never exceeds
 a few percent and so this term can be ignored in the light of the gross approximations involved is $\beta$ and $Q_h$ above and so we arrive at

 $Q_{ov} = 0.75 Q_s / (\rho C_p)$

### References

1. BLIPMAP Prediction Parameters and Description. Dr. John W. (Jack) Glendening.
<http://www.drjack.info/blip/INFO/parameters.html>

2. Updraft Model for Development of Autonomous Soaring Uninhabited Air
Vehicles. Michael J. Allen, NASA Dryden Flight Research Center, Edwards,
California 93523-0273, USA
<https://ntrs.nasa.gov/api/citations/20060004052/downloads/20060004052.pdf>

3. Lenschow & Stephens (1980)
<https://www.researchgate.net/publication/226285031_The_role_of_thermals_in_the_convective_boundary_layer>

4. Glossary of Meteorology -- The American Meteorological Society
<https://glossarytest.ametsoc.net/wiki/Deardorff_velocity>

5. Convective Velocity and Temperature Scales for the Unstable Planetary Boundary Layer and for Rayleigh Convection
James W. Deardorff (1970)
<https://journals.ametsoc.org/view/journals/atsc/27/8/1520-0469_1970_027_1211_cvatsf_2_0_co_2.xml>
