/**
 * @author Adam Meisenheimer (https://github.com/Adam-Meisen)
 */

const Critical = require('./vendor/critical');
const Vinyl = require('vinyl');
const path = require('path');
const _ = require('lodash');

class CriticalCSSWebpackPlugin {
  constructor(options) {
    // define this here so I don't have to type the full name later
    this.vinylizeCSSFile = CriticalCSSWebpackPlugin.vinylizeCSSFile;
    const defaultOptions = {
      /** @type {RegExp | boolean} include */
      include: /\.html?$/,
      /** @type {RegExp | RegExp[] | boolean} exclude */
      exclude: false,
      /** @type {RegExp | RegExp[] | boolean} cssInclude */
      cssInclude: /\.css$/,
      /** @type {RegExp | RegExp[] | boolean} cssExclude */
      cssExclude: false,
      criticalOptions: {
        /** @type {boolean} inline */
        inline: true,
        /** @type {object | boolean} minify */
        minify: false,
      },
    };
    this.options = _.defaultsDeep({}, options, defaultOptions);
  }

  /**
   *  @param {?} compiler - webpack compiler object
   */
  apply(compiler) {
    const options = this.options;
    const self = this;
    compiler.plugin('compilation', (compilation) => {
      // with html-webpack-plugin
      compilation.plugin('html-webpack-plugin-after-html-processing',
        /**
         *  @param {{plugin: {assetJson: string}}} htmlPluginData
         *  @param {function} callback
         */
        (htmlPluginData, callback) => {
          /** @type {string} filename */
          const filename = htmlPluginData.outputName;

          /** @type {string[]} assets */
          const assets = JSON.parse(htmlPluginData.plugin.assetJson);

          debugger;
          // filter assets to just css files
          const cssFiles = assets.filter(name => options.cssInclude.test(name))
            // convert css filenames to virtual files
            .map((cssFilename) => {
              if (Vinyl.isVinyl(cssFilename)) return cssFilename;
              debugger;
              return this.vinylizeCSSFile(
                cssFilename,
                options.criticalOptions.base,
                Buffer.from(compilation.assets[cssFilename].source()));
            });
          // if the filename matches include pattern and doesn't match exclude pattern
          debugger;
          if (options.include.test(filename) && ((typeof options.exclude.test === 'function') ? !options.exclude.test(filename) : true)) {
            /** @type {string} source */
            const source = htmlPluginData.html;

            // send source to Critical
            self.sendToCritical(source, cssFiles)
              .then((modifiedSource) => {
                // now we have the source with critical CSS injected
                /** @type {{html: string}} newHtmlPluginData */
                const newHtmlPluginData = htmlPluginData;

                // I don't know why, but sometimes Critical returns a utf8 buffer,
                // and other times it returns a string.
                if (typeof modifiedSource !== 'string') {
                  console.log('modifiedSource is a: ', typeof modifiedSource);
                  // console.log(modifiedSource);
                  newHtmlPluginData.html = String.fromCharCode(...new Uint8Array(modifiedSource));
                } else newHtmlPluginData.html = modifiedSource;
                debugger;

                // return control to html-webpack-plugin
                return callback(null, newHtmlPluginData);
              })
              .catch((err) => {
                console.log(err);
                return err;
              });
          } else callback(null, htmlPluginData);
        });
    });
  }

  /** send HTML from module to Critical
   * @returns {promise}
   * @param {string} source
   * @param {string[]} cssFiles
   * @param {function} callback
   */
  sendToCritical(source, cssFiles) {
    let criticalOptions = {
      html: source,
      css: cssFiles,
    };
    criticalOptions = Object.assign({}, this.options.criticalOptions, criticalOptions);
    debugger;

    // returns promise that resolves to html result or error
    return Critical.generate(criticalOptions);
  }

  /**
   * @param {string} filename
   * @param {string} basePath
   * @param {Buffer} fileContents
   */
  static vinylizeCSSFile(filename, basePath, fileContents) {
    const vinylOpts = {
      cwd: basePath,
      base: basePath,
      path: path.join(basePath, filename),
      contents: fileContents,
    };
    debugger;
    return new Vinyl(vinylOpts);
  }

  /**
   * @returns {boolean}
   * @param {string} filename - name of or path to HTML file
   * @param {string} type - should be 'html' or 'css'
   */
  HTMLFilter(filepath, type) {
    /** @type {RegExp[]} include */
    const include = _.castArray(this.options.include);
    /** @type {RegExp[]} exclude */
    const exclude = _.castArray(this.options.exclude);

    // if `filepath` matches at least one pattern in `options.include`
    if (include.some(regex => regex.match(filepath))) {
      // if `filepath` matches none of the patterns in `options.exclude`
      if (!exclude.some(regex => regex.match(filepath))) {
        return true;
      }
    }
    return false;
  }
}

module.exports = CriticalCSSWebpackPlugin;
