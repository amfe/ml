var fs = require('fs');
var path = require('path');
var gulp  = require('gulp');
var gutil = require('gulp-util');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var jshint = require('gulp-jshint');
var cssmin = require('gulp-cssmin');
var rename = require('gulp-rename');

var BUILD_PATH = './';
var BOWER_PATH = './bower_components';

var jsfiles = [
'lib.flexible/flexible.js',
'lib.promise/promise.js',
'lib.navigation/navigation.js',
'lib.gesture/gesture.js',
'lib.motion/motion.js',
'lib.animation/animation.js',
'lib.cubicbezier/cubicbezier.js',
'lib.scroll/scroll.js',

'ctrl.loading/loading.js',
'ctrl.scrollview/scrollview.js',
'ctrl.pageview/pageview.js',
].map(function(file) {
    return BOWER_PATH + '/' + file;
});

var cssfiles = [
'lib.flexible/flexible.css',
'ctrl.loading/loading.css',
'ctrl.scrollview/scrollview.css',
'ctrl.pageview/pageview.css',
].map(function(file) {
    return BOWER_PATH + '/' + file;
});

gulp.task('build-css', function() {
    var stream = gulp.src(cssfiles)
        .pipe(concat('ml.css'))
        .pipe(gulp.dest(BUILD_PATH));
    return stream;
});

gulp.task('minify-css', ['build-css'], function() {
    var stream = gulp.src(BUILD_PATH + '/ml.css')
        .pipe(cssmin())
        .pipe(rename(function(path) {
            path.basename += '-min';
        }))
        .pipe(gulp.dest(BUILD_PATH));

    return stream;
});

gulp.task('build-js', function() {
    var stream = gulp.src(jsfiles)
        .pipe(concat('ml.js'))
        .pipe(gulp.dest(BUILD_PATH));

    return stream;
});

gulp.task('minify-js', ['build-js'], function() {
    var stream = gulp.src(BUILD_PATH + '/ml.js')
        .pipe(uglify())
        .pipe(rename(function(path) {
            path.basename += '-min';
        }))
        .pipe(gulp.dest(BUILD_PATH));

    return stream;
});

gulp.task('build', ['build-js', 'build-css']);
gulp.task('minify', ['minify-js', 'minify-css']);

gulp.task('watch-js', function() {
    gulp.watch(jsfiles, ['build-js']);
});

gulp.task('watch-css', function() {
    gulp.watch(cssfiles, ['build-css']);
});

gulp.task('default', ['build', 'minify']);
gulp.task('dev', ['build', 'watch-js', 'watch-css']);