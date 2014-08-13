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

gulp.task('build', function() {

    var jsfiles = ['rem/rem.js'];
    var cssfiles = ['rem/rem.css'];

    fs.readdirSync(BUILD_PATH).filter(function(dir) {
        return !!dir.match(/^lib|ctrl/);
    }).forEach(function(dir) {
        var name = dir.match(/^(?:lib|ctrl)\.(.+)$/)[1];
        var filepath = path.join(dir, name + '.js');
        if (fs.existsSync(filepath)) {
            jsfiles.push(filepath);
        }
        filepath = path.join(dir, name + '.css');
        if (fs.existsSync(filepath)) {
            cssfiles.push(filepath);
        }
    });

    gulp.src(jsfiles)
        .pipe(concat('ml.js'))
        .pipe(uglify())
        .pipe(gulp.dest(BUILD_PATH));

    gulp.src(cssfiles)
        .pipe(concat('ml.css'))
        .pipe(cssmin())
        .pipe(gulp.dest(BUILD_PATH));
});

gulp.task('default', ['build']);