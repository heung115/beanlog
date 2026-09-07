# OpenCV 4.10.0 JS binding whitelist for PaddleOCR.js 0.4.2.
# Mat, MatVector and structural types are supplied by core_bindings.cpp;
# helpers.js retains matFromArray and the structural convenience constructors.
core = {'': ['mean', 'rotate']}
imgproc = {'': [
    'fillPoly', 'minAreaRect', 'cvtColor', 'findContours', 'resize',
    'getPerspectiveTransform', 'warpPerspective',
]}
white_list = makeWhiteList([core, imgproc])
