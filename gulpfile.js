var BUILD_PATH = './';
var DEMO_PATH = './demo';

var fs = require('fs');
var path = require('path');
var gulp  = require('gulp');
var gutil = require('gulp-util');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var jshint = require('gulp-jshint');
var cssmin = require('gulp-cssmin');

var jsfiles = ['lib.flexible/flexible.js'];
var cssfiles = ['lib.flexible/flexible.css'];

fs.readdirSync(BUILD_PATH).filter(function(dir) {
    return !!dir.match(/^lib|ctrl/);
}).forEach(function(dir) {
    var filepath;
    var name = dir.match(/^(?:lib|ctrl)\.(.+)$/)[1];
    if (name === 'flexible') return;

    filepath = path.join(dir, name + '.js');
    if (fs.existsSync(filepath)) {
        jsfiles.push(filepath);
    }

    filepath = path.join(dir, name + '.css');
    if (fs.existsSync(filepath)) {
        cssfiles.push(filepath);
    }
});


gulp.task('build', function() {
    gulp.src(jsfiles)
        .pipe(concat('ml.js'))
        .pipe(uglify())
        .pipe(gulp.dest(BUILD_PATH));

    gulp.src(cssfiles)
        .pipe(concat('ml.css'))
        .pipe(cssmin())
        .pipe(gulp.dest(BUILD_PATH));
});

gulp.task('dev-build', function() {
    gulp.src(jsfiles)
        .pipe(concat('ml.js'))
        .pipe(gulp.dest(BUILD_PATH));

    gulp.src(cssfiles)
        .pipe(concat('ml.css'))
        .pipe(gulp.dest(BUILD_PATH));
});

gulp.task('watch', function() {
    gulp.watch(jsfiles, ['dev-build']);
    gulp.watch(cssfiles, ['dev-build']);
});

gulp.task('default', ['build']);
gulp.task('dev', ['dev-build', 'watch'])