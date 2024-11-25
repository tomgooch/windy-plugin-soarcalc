# Windy Plugin SoarCalc

Soaring Calculations. Presents thermal soaring parameters W*, Thermal height etc (as per RASP)

[manual/discussion](/../docs/SoarCalc.md)

[installation](/../docs/Installation.md)

## CHANGELOG

- 0.1.6
  - Total rework of documentation
  - Major cleanup of code
  - Subscribe to singleClick events from both Sounding forecast and details/meteogram forecast so as to remain in sync at exactly the same location
  - Request forecast data at 1 hour intervals so that premium Windy.com users benefit from this.  (non-premium users continue to receive 3 hour intervals)
  - Add error message when problems occur - notably when model elevation is not available! (AROME/AROME-HD)

- 0.1.2
  - improve initialization
  - grey out Cu base etc when above BL top
  - adjust calculation of Hcrit to fall inline with RASP
  - respond to single click events from "sounding"
  - show popup on first opening to explain parameters

- 0.1.1
  - Initial version of this repo
