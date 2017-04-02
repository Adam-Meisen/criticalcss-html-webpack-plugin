/**
 * @author Adam Meisenheimer (https://github.com/Adam-Meisen)
 */

const Critical = require('critical');
const _ = require('lodash');
const Vinyl = require('vinyl');
const path = require('path');

const defaultOptions = {
  testKey1: 'testVal1',
  testKey2: 'testVal2',
  /** @type {RegExp | RegExp[] | boolean} include */
  include: /\.html?$/,
  /** @type {RegExp | RegExp[] | boolean} exclude */
  exclude: false,
  /** @type {RegExp | RegExp[] | boolean} exclude */
  cssFilter: /\.css$/,
  criticalOptions: {
    /** @type {boolean} inline - inline generated CSS */
    inline: true,
    /** @type {object | boolean} minify - minify generated CSS */
    minify: false,
    /** @type {string} base*/
    base: '',
  },
};

class CriticalCSSInjectorWebpackPlugin {
  constructor(options) {
    // this.options = Object.assign({}, defaultOptions, options);
    this.options = _.defaultsDeep({}, options, defaultOptions);
    this.vinylizeCSSFile = CriticalCSSInjectorWebpackPlugin.vinylizeCSSFile;
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
          const cssFiles = assets.filter(name => options.cssFilter.test(name))
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
                if (typeof modifiedSource !== 'string') {
                  console.log('modifiedSource: ', typeof modifiedSource);
                  console.log(modifiedSource);
                  newHtmlPluginData.html = String.fromCharCode(...new Uint8Array(modifiedSource));
                } else newHtmlPluginData.html = modifiedSource;
                debugger;

                // return to html-webpack-plugin
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
    // convert css filenames such as 'test.css' to paths
    let criticalOptions = {
      html: source,
      assetPaths: [],
      css: cssFiles,
    };
    criticalOptions = Object.assign({}, this.options.criticalOptions, criticalOptions);
    debugger;

    // returns promise that resolves to html string or error
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
}

module.exports = CriticalCSSInjectorWebpackPlugin;
