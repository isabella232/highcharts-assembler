/* eslint-env node, es6 */
/* eslint func-style: ["error", "expression"] */
'use strict'
const defaultOptions = require('./defaultOptions.js')
const {
  compileFile
} = require('./dependencies')
const {
  getPalette,
  preProcess,
  printPalette,
  transpile
} = require('./process.js')
const {
  debug,
  getFile,
  isObject,
  isString,
  writeFile
} = require('./utilities.js')
const fs = require('fs')
const {
    join,
    resolve
} = require('path')
const beautify = require('js-beautify').js_beautify

/**
 * [getFilesInFolder description]
 * @param  {[type]} base              [description]
 * @param  {[type]} includeSubfolders [description]
 * @param  {[type]} path              [description]
 * @returns {[type]}                   [description]
 */
const getFilesInFolder = (base, includeSubfolders, path) => {
  let filenames = []
  let pathSubFolder = isString(path) ? path : ''
  fs.readdirSync(base + pathSubFolder).forEach((filename) => {
    let filepath = base + pathSubFolder + filename
    let isDirectory = fs.lstatSync(filepath).isDirectory()
    if (isDirectory && includeSubfolders) {
      filenames = filenames.concat(getFilesInFolder(base, includeSubfolders, pathSubFolder + filename + '/'))
    } else if (!isDirectory) {
      filenames.push(pathSubFolder + filename)
    }
  })
  return filenames
}

/**
 * Left pad a string
 * @param  {string} str    The string we want to pad.
 * @param  {string} char   The character we want it to be padded with.
 * @param  {number} length The length of the resulting string.
 * @returns {string}        The string with padding on left.
 */
const leftPad = (str, char, length) => char.repeat(length - str.length) + str

const getDate = () => {
  const date = new Date()
  const pad = (str) => leftPad(str, '0', 2)
  return ['' + date.getFullYear(), pad('' + (date.getMonth() + 1)), pad('' + date.getDate())].join('-')
}

/**
 * Get options foreach individual
 * @param  {object} options General options for all files
 * @returns {[object]}       Array of indiviual file options
 */
const getIndividualOptions = (options) => {
  return options.files.reduce((arr, filename) => {
    let o = Object.assign({}, options, options.fileOptions && options.fileOptions[filename])
    o.entry = o.base + filename
    delete o.fileOptions
    let types = o.type === 'both' ? ['classic', 'css'] : [o.type]
    let typeOptions = types.map(t => {
      let folder = t === 'classic' ? '' : 'js/'
      let build = {
        classic: {
          assembly: true,
          classic: true,
          palette: o.palette
        },
        css: {
          classic: false,
          palette: o.palette
        }
      }
      return Object.assign({
        build: build[t]
      }, o, {
        type: t,
        outputPath: options.output + folder + filename,
        filename: filename
      })
    })
    return arr.concat(typeOptions)
  }, [])
}

/**
 * Function which gathers all dependencies, merge options and build the final distribution file.
 * @param  {object|undefined} userOptions Build options set by the user
 * @returns {undefined} No return value
 */
const build = userOptions => {
    // userOptions is an empty object by default
  userOptions = isObject(userOptions) ? userOptions : {}
    // Merge the userOptions with defaultOptions
  let options = Object.assign({}, defaultOptions, userOptions)
    // Check if required options are set
  if (options.base) {
    options.palette = (options.palette) ? options.palette : getPalette((options.jsBase ? options.jsBase : options.base + '../') + '../css/highcharts.scss')
    printPalette(options.output + 'palette.html', options.palette)
    options.date = options.date ? options.date : getDate()
    options.files = (options.files) ? options.files : getFilesInFolder(options.base, true)
    getIndividualOptions(options)
            .forEach((o, i, arr) => {
              let file = compileFile(o)
              file = preProcess(file, o.build)
              if (o.transpile) {
                file = transpile(file)
              }
              if (o.pretty) {
                file = beautify(file)
              }
              writeFile(o.outputPath, file)
              debug(o.debug, [
                'Completed ' + (i + 1) + ' of ' + arr.length,
                '- type: ' + o.type,
                '- entry: ' + o.entry,
                '- output: ' + o.outputPath
              ].join('\n'))
            })
  } else {
    debug(true, 'Missing required option! The options \'base\' is required for the script to run')
  }
}

const buildModules = userOptions => {
    // userOptions is an empty object by default
  userOptions = isObject(userOptions) ? userOptions : {}
    // Merge the userOptions with defaultOptions
  let options = Object.assign({}, defaultOptions, userOptions)
    // Check if required options are set
  if (options.base) {
    options.palette = (options.palette)
    ? options.palette
    : getPalette(
      (
        isString(options.pathPalette)
        ? options.pathPalette
        : options.base + '../css/highcharts.scss'
      )
    )
    options.files = getFilesInFolder(options.base, true)
      .filter(path => path.endsWith('.js'))
    getIndividualOptions(options)
            .forEach((o) => {
              let content = getFile(o.entry)
              const outputPath = join(
                  options.output,
                  (o.type === 'css' ? 'js' : ''),
                  'es-modules',
                  o.filename
              )
              let file = preProcess(content, o.build)
              writeFile(resolve(outputPath), file)
            })
  } else {
    debug(true, 'Missing required option! The options \'base\' is required for the script to run')
  }
}

module.exports = {
  build,
  buildModules,
  getFilesInFolder
}
