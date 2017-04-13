/**
 * @author Adam Meisenheimer (https://github.com/Adam-Meisen)
 */

/** CustomFilter
 * @typedef CustomFilter
 * @type {Object}
 * @property {RegExp | RegExp[]} include
 * @property {RegExp | RegExp[] | boolean} exclude
 */

/** CriticalOptions
 * @typedef CriticalOptions
 * @type {Object}
 * @summary https://github.com/addyosmani/critical#options
 */

/** ConfigOptions
 * @typedef ConfigOptions
 * @type {Object}
 * @property {CustomFilter} html
 * @property {CustomFilter} css
 * @property {Object} custom
 * @property {CriticalOptions} CriticalOptions
 */

const Critical = require('./vendor/critical');
const Vinyl = require('vinyl');
const path = require('path');
const _ = require('lodash');

class CriticalCSSWebpackPlugin {
  /** Creates an instance of CriticalCSSWebpackPlugin.
   * @param {ConfigOptions} options
   *
   * @memberOf CriticalCSSWebpackPlugin
   */
  constructor(options) {
    // attach these static functions here so I don't have to type the full name later
    this.vinylizeCSSFile = CriticalCSSWebpackPlugin.vinylizeCSSFile;
    this.fileFilter = CriticalCSSWebpackPlugin.FileFilter;


    this.options = CriticalCSSWebpackPlugin.setupOptions(options);
  }
  /** Apply default options and normalize options object
   * @param {ConfigOptions} options
   * @returns {ConfigOptions}
   *
   * @memberOf CriticalCSSWebpackPlugin
   */
  static setupOptions(options) {
    /** @type {ConfigOptions} opts */
    let opts = {};

    /** @type {ConfigOptions} defaultOptions*/
    const defaultOptions = {
      html: {
        include: /\.html?$/,
        exclude: false,
      },
      css: {
        include: /\.css$/,
        exclude: false,
      },
      /**
       * Custom rules for files matching certain Regular expressions
       * @type {boolean | {a: {include: RegExp | RegExp[], exclude: RegExp | RegExp[]}}}
       */
      custom: {
        /** custom filters go here */
        a: {
          include: /^(?!\s*$).+/,
          exclude: /^(?!\s*$).+/,
          criticalOptions: {
            /** options that only apply to files that match previous regex */
          },
        },
      },
      criticalOptions: {
        inline: true,
        minify: false,
      },
    };
    opts = _.defaultsDeep(opts, options, defaultOptions);
    return opts;
  }

  /** Hook into compiler
   * @param {?} compiler - webpack compiler object
   *
   * @memberOf CriticalCSSWebpackPlugin
   */
  apply(compiler) {
    const options = this.options;
    const self = this;
    compiler.plugin('compilation', (compilation) => {
      compilation.plugin('html-webpack-plugin-after-html-processing',
        /**
         *  @param {{plugin: {assetJson: string}}} htmlPluginData
         *  @param {function} callback
         */
        (htmlPluginData, callback) => {
          /** @type {ConfigOptions} opts */
          const opts = this.options;
          /** @type {string} filename */
          const filename = htmlPluginData.outputName;
          if (!this.fileFilter(filename, opts.html)) {
            // the html filename does not pass the html file filter
            return callback(null, htmlPluginData);
          }

          /** @type {string[]} assets */
          const assets = JSON.parse(htmlPluginData.plugin.assetJson);

          // filter assets to just css files
          const cssFiles = assets.filter(filepath => this.fileFilter(filepath, opts.css))
            // convert css filenames to virtual files
            .map((cssFilename) => {
              if (Vinyl.isVinyl(cssFilename)) return cssFilename;

              return this.vinylizeCSSFile(
                cssFilename,
                options.criticalOptions.base,
                Buffer.from(compilation.assets[cssFilename].source()));
            });

          // if the filename matches include patterns and doesn't match exclude patterns
          /** @type {string} source */
          const source = htmlPluginData.html;

          // send source to Critical
          return self.sendToCritical(source, cssFiles)
            .then((modifiedSource) => {
              // now we have the source with critical CSS injected
              /** @type {{html: string}} newHtmlPluginData */
              const newHtmlPluginData = htmlPluginData;

              // I don't know why, but sometimes Critical returns a utf8 buffer,
              // and other times it returns a string.
              if (typeof modifiedSource !== 'string') {
                newHtmlPluginData.html = String.fromCharCode(...new Uint8Array(modifiedSource));
              } else newHtmlPluginData.html = modifiedSource;

              // return control to html-webpack-plugin
              return callback(null, newHtmlPluginData);
            })
            .catch((err) => {
              console.log(err);
              return err;
            });
        });
    });
  }

  /** send HTML from module to Critical
   * @returns {promise}
   * @param {string} source
   * @param {string[]} cssFiles
   * @param {function} callback
   *
   * @memberOf CriticalCSSWebpackPlugin
   */
  sendToCritical(source, cssFiles) {
    let criticalOptions = {
      html: source,
      css: cssFiles,
    };
    criticalOptions = Object.assign({}, this.options.criticalOptions, criticalOptions);
    // debugger;

    // returns promise that resolves to html result or error
    return Critical.generate(criticalOptions);
  }

  /**
   * @param {string} filename
   * @param {string} basePath
   * @param {Buffer} fileContents
   *
   * @memberOf CriticalCSSWebpackPlugin
   */
  static vinylizeCSSFile(filename, basePath, fileContents) {
    const vinylOpts = {
      cwd: basePath,
      base: basePath,
      path: path.join(basePath, filename),
      contents: fileContents,
    };
    // debugger;
    return new Vinyl(vinylOpts);
  }

  /** Filter files with a given filter
   * @returns {boolean}
   * @param {string} filename - name of or path to HTML file
   * @param {CustomFilter} filter
   *
   * @memberOf CriticalCSSWebpackPlugin
   */
  static FileFilter(filepath, filter) {
    const include = _.castArray(filter.include);
    const exclude = (() => {
      if (typeof filter.exclude === 'boolean') {
        return false;
      }
      return _.castArray(filter.exclude);
    })();

    // if `filepath` matches at least one pattern in `include`
    if (include.some(regex => regex.test(filepath))) {
      // if `exclude` is false or`filepath` matches none of the patterns in `exclude`
      if (!exclude) {
        return true;
      }
      // exclude must be RegExp or RegExp[]
      if (!exclude.some(regex => regex.test(filepath))) {
        return true;
      }
    }
    return false;
  }

}

module.exports = CriticalCSSWebpackPlugin;
