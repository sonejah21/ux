var gulp = require('gulp');
var util = require('gulp-util');
var concat = require('gulp-concat');
var plumber = require('gulp-plumber');
var bower = require('gulp-bower');
var server = require( 'gulp-develop-server');
var es = require('event-stream');

// JS Hint
var jshint = require('gulp-jshint');
var filter = require('gulp-filter');

// JavaScript
var browserify = require('browserify');
var transform = require('vinyl-transform');
var unpathify = require('gulp-unpathify');
var uglify = require('gulp-uglify');

// Templates
var templates = require('gulp-angular-templatecache');

// CSS
var sass = require('gulp-ruby-sass');
var autoprefix = require('gulp-autoprefixer');
var minifyCSS = require('gulp-minify-css');

// Images
var imagemin = require('gulp-imagemin');
var pngquant = require('imagemin-pngquant');

// Utils
var clean = require('gulp-clean');
var notify = require('gulp-notify');

var errorHandler = function(err) {
  util.log(util.colors.red('Error'), err.message);
  this.emit('end');
};

var appAssetSrc = 'assets';
var appAssetDest = 'public';
var bowerPath = './bower_components';
var theme = 'pepper-grinder';
var paths = {
    src: {
      scripts: ['./' + appAssetSrc + '/js/main.js'],
      partials: [appAssetSrc + '/templates/partials/**/*.html'],
      views: [appAssetSrc + '/templates/views/**/*.html'],
      styles: [
        appAssetSrc + '/sass/styles.sass'
      ],
      ieStyles: [
        appAssetSrc + '/sass/ie.sass'
      ],
      images: [
        appAssetSrc + '/images/**/*'
      ],
      fonts: [appAssetSrc + '/fonts/**/*']
    },
    bower: bowerPath,
    dest: {
      scripts: appAssetDest + '/js',
      partials: appAssetDest + '/templates',
      views: appAssetDest + '/views',
      styles: appAssetDest + '/css',
      images: appAssetDest + '/images',
      fonts: appAssetDest + '/fonts'
    }
  };

gulp.task('bower', function() {
  return bower()
    .pipe(gulp.dest(paths.bower));
});

gulp.task('jshint', ['bower'], function() {
  var jsFilter = filter(['*', '!' + appAssetSrc + '/js/vendor']);

  return gulp.src(appAssetSrc + '/js/**/*.js')
    .pipe(plumber({
      errorHandler: errorHandler
    }))
    .pipe(jsFilter)
    .pipe(jshint())
    .pipe(jshint.reporter('jshint-stylish-recolor'))
    .pipe(jshint.reporter('fail'))
    .on('error', notify.onError({
      message: 'JS Hinting task failed',
      sound: "Sosumi"
    }))
    .pipe(notify({ message: 'JS Hinting task complete' }))
    .pipe(jsFilter.restore());
});

gulp.task('clean-templates', function() {
  gulp.src(paths.dest.views, {read: false})
    .pipe(clean({force: true}));
  gulp.src(paths.dest.partials, {read: false})
    .pipe(clean({force: true}));
});

gulp.task('templates', ['bower', 'clean-templates'], function() {
  // Copy over views
  gulp.src(paths.src.views)
    .pipe(gulp.dest(paths.dest.views));

  // Concat and compress partials into a browserfied templateCache
  gulp.src(paths.src.partials)
    .pipe(templates({
      root: '/partials/',
      module: 'templates',
      standalone: true,
      moduleSystem: "Browserify"
    }))
    .pipe(gulp.dest(paths.dest.partials));
});

gulp.task('clean-scripts', function() {
  return gulp.src(paths.dest.scripts, {read: false})
    .pipe(clean({force: true}));
});

/**
 * Minify, Concat JS Files
 *
 * Dependent on templates because template partials are wrapped into a
 * js file required here.
 */
gulp.task('scripts', ['bower', 'templates', 'clean-scripts'], function() {

  var browserified = transform(function(filename) {
    var b = browserify(filename);
    return b.bundle();
  });

  // Combine all the js, browserify it, uglify it, write out the bundle file.
  return gulp.src(paths.src.scripts)
    .pipe(plumber({
      errorHandler: errorHandler
    }))
    .pipe(browserified)
    .pipe(unpathify())
    .pipe(concat('bundle.js'))
    .pipe(uglify({preserveComments: 'some'}))
    .pipe(gulp.dest(paths.dest.scripts))
    .pipe(notify({message: 'Finished scripts task.'}));
});

gulp.task('clean-styles', function() {
  return gulp.src(paths.dest.styles, {read: false})
    .pipe(clean({force: true}));
});

gulp.task('styles', ['bower', 'clean-styles', 'ie-styles'], function() {
  // Vendor Angular Loading Bar CSS
  var angularLoadingBarFiles = gulp.src(paths.bower + '/angular-loading-bar/build/loading-bar.css');

  // App Sass files and Vendor Sass Files
  var sassFiles = gulp.src(paths.src.styles)
    .pipe(sass({
      loadPath: [
          paths.bower + '/bootstrap-sass-official/assets/stylesheets',
          paths.bower + '/fontawesome/scss'
      ]
    }).on("error", notify.onError(function(error) {
      return "Error: " + error.message;
    })));

  // Combine the output from Sass/Vendor, Concat, minify, autprefix.
  return es.concat(angularLoadingBarFiles, sassFiles)
    .pipe(concat('styles.css'))
    .pipe(autoprefix("last 2 version", "> 1%"))
    .pipe(notify({message: 'Finished styles task.'}))
    .pipe(minifyCSS())
    .pipe(gulp.dest(paths.dest.styles));
});

/**
 * Since we concat all the sass output above, we use a separate directive to
 * actually get a separate stylesheet.
 */
gulp.task('ie-styles', ['bower'], function() {
  return gulp.src(paths.src.ieStyles)
    .pipe(sass())
    .on("error", notify.onError(function (error) {
      return "Error: " + error.message;
    }))
    //.pipe(minifyCSS())
    .pipe(gulp.dest(paths.dest.styles));
});

gulp.task('clean-images', function() {
  return gulp.src(paths.dest.images, {read: false})
    .pipe(clean({force: true}));
});

gulp.task('images', ['bower', 'clean-images'], function() {
  return gulp.src(paths.src.images)
    .pipe(plumber({
      errorHandler: errorHandler
    }))
    .pipe(imagemin({
      optimizationLevel: 7,
      progressive: true,
      interlaced: true,
      use: [pngquant()]
    }))
    .pipe(gulp.dest(paths.dest.images))
    .pipe(notify({message: 'Finished images task.'}));
});

gulp.task('clean-fonts', function() {
  return gulp.src(paths.dest.fonts, {read: false})
    .pipe(clean({force: true}));
});

gulp.task('fonts', ['clean-fonts', 'icons'], function() {
  // Move internal system fonts
  gulp.src(paths.src.fonts)
    .pipe(gulp.dest(paths.dest.fonts));

  // Move angular glypicon font.
  gulp.src(paths.bower + '/bootstrap-sass-official/assets/fonts/**/*')
    .pipe(gulp.dest(paths.dest.fonts));
});

gulp.task('icons', ['bower'], function() {
  return gulp.src(paths.bower + '/fontawesome/fonts/**.*')
    .pipe(gulp.dest(paths.dest.fonts));
});

// run server
gulp.task( 'server:start', function() {
  server.listen( { path: './app.js' } );
});

// restart server if app.js changed
gulp.task( 'server:restart', function() {
  gulp.watch( [ './app.js' ], server.restart );
});

gulp.task('watch', function() {
  // watches JavaScript files for changes
  gulp.watch(appAssetSrc + '/js/**/*.js', ['jshint', 'scripts']);

  // Watch and recompile templates
  gulp.watch(appAssetSrc + '/templates/**/*.html', ['scripts']);

  // watches Sass files for changes
  gulp.watch(appAssetSrc + '/sass/**/*.s?ss', ['styles']);

  // watches Image files for changes
  gulp.watch(appAssetSrc + '/images/**/*', ['images']);
});

gulp.task('default', ['scripts', 'styles', 'images', 'fonts', 'watch']);

gulp.task('production', ['scripts', 'styles', 'images', 'fonts']);