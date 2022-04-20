import FileFormat from '@sketch-hq/sketch-file-format-ts'
import { fromFile, SketchFile } from '@sketch-hq/sketch-file'
import { resolve } from 'path'
import * as fs from 'fs'
import rgbHex from 'rgb-hex'
import { isDeepStrictEqual } from 'util'

const sketchDocumentPath = '../sample-file.sketch'

// #region Default constants
// filltType
// 0 = Fill
// 1 = Gradient
// gradientType
// 0 = Linear
// 1 = Radial
// 2 = Angular
const borderPosition = ['Inside', 'Center', 'Outside']
const gradientTypeValue = [
  'linear-gradient',
  'radial-gradient',
  'angular-gradient',
]
const gradientCircleType = ['circle', 'ellipse']
const imageFillType = ['tile', 'fill', 'stretch', 'fit']

// Color Tokens (Color Variables ONLY)
const colorTokens = {}
// #endregion

// Load the Sketch document and parse it into a SketchFile object
fromFile(resolve(__dirname, sketchDocumentPath)).then(
  (parsedFile: SketchFile) => {
    const document = parsedFile.contents.document
    // Exit if the document does not have any Color Variables
    if (!document.sharedSwatches) return

    // Default variables
    const variablePrefix = '$'
    const keyToDelete = 'length'
    const separator = '-'
    let designTokensList = {}

    // #region Color Variables
    // Sort color swatches by name. Uses `localCompare` to sort
    // numbers properly. https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/localeCompare
    const swatches: FileFormat.Swatch[] = document.sharedSwatches.objects.sort(
      (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })
    )

    swatches.forEach(swatch => {
      let swatchColor = rgbHex(
        swatch.value.red * 255,
        swatch.value.green * 255,
        swatch.value.blue * 255,
        swatch.value.alpha
      )
      if (swatch.name.indexOf('/') > -1) {
        createNestedObject(colorTokens, swatch.name.split('/'), swatchColor)
      } else {
        colorTokens[swatch.name] = swatchColor
      }
    })
    // #endregion

    // #region Layer Styles
    const layerStyles = document.layerStyles.objects.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true })
    )
    // Color styles checks
    let layerStylesTokensList = {}
    let layerStyleTokens = {}

    let layerStylesComplete = false

    // #region Shadow styles
    let shadowStyles = {}
    for (const style of layerStyles) {
      let shadows = style.value.shadows
      let shadowCounter = 1
      for (const shadow of shadows) {
        let currentShadow = {}
        if (shadow.isEnabled) {
          let color = shadow.color
          let currentColor = rgbHex(
            color.red * 255,
            color.green * 255,
            color.blue * 255,
            color.alpha
          )
          if (checkToken(colorTokens, currentColor) === false) {
            currentShadow['shadow-color'] = currentColor
          } else {
            currentShadow['shadow-color'] =
              variablePrefix +
              getKeyByValue(colorTokens, currentColor, variablePrefix)
          }
          currentShadow['shadow-blur-radius'] = shadow.blurRadius
          currentShadow['shadow-offset-x'] = shadow.offsetX
          currentShadow['shadow-offset-y'] = shadow.offsetY
          currentShadow['shadow-spread'] = shadow.spread

          if (!checkToken(currentShadow, shadowStyles)) {
            let currentShadowName = 'shadow-' + shadowCounter
            createCouples(shadowStyles, currentShadow, currentShadowName, '', 0)
            shadowCounter++
          }
        }
      }
      shadowCounter = 1
    }
    // #endregion

    // #region Inner Shadow styles
    let innerShadowStyles = {}
    for (const style of layerStyles) {
      let shadows = style.value.innerShadows
      let shadowCounter = 1
      for (const shadow of shadows) {
        let currentShadow = {}
        if (shadow.isEnabled) {
          let color = shadow.color
          let currentColor = rgbHex(
            color.red * 255,
            color.green * 255,
            color.blue * 255,
            color.alpha
          )

          if (checkToken(colorTokens, currentColor) === false) {
            currentShadow['inner-shadow-color'] = currentColor
          } else {
            currentShadow['inner-shadow-color'] =
              variablePrefix +
              getKeyByValue(colorTokens, currentColor, variablePrefix)
          }
          currentShadow['inner-shadow-blur-radius'] = shadow.blurRadius
          currentShadow['inner-shadow-offset-x'] = shadow.offsetX
          currentShadow['inner-shadow-offset-y'] = shadow.offsetY
          currentShadow['inner-shadow-spread'] = shadow.spread

          if (!checkToken(currentShadow, innerShadowStyles)) {
            let currentShadowName = 'inner-shadow-' + shadowCounter
            createCouples(
              innerShadowStyles,
              currentShadow,
              currentShadowName,
              '',
              0
            )
            shadowCounter++
          }
        }
      }
      shadowCounter = 1
    }
    // #endregion

    // #region gradients
    let gradientStyles = {}
    let gradientStylesForComparison = {}
    let counterLinear = 0
    let counterRadial = 0
    let counterAngular = 0
    for (const style of layerStyles) {
      let fills = style.value.fills

      let counter = 1

      for (const fill of fills) {
        if (fill.fillType === 1) {
          let currentGradient = {}
          let gradientType = fill.gradient.gradientType
          if (gradientType === 0) {
            counterLinear++
            counter = counterLinear
          } else if (gradientType === 1) {
            counterRadial++
            counter = counterRadial
          } else {
            counterAngular++
            counter = counterAngular
          }
          let currentGradientName =
            gradientTypeValue[gradientType] + separator + counter.toString()

          currentGradient = setGradientDetails(
            currentGradient,
            fill,
            gradientType,
            variablePrefix
          )
          let gradientStylesCheck = {}
          createCouples(
            gradientStylesCheck,
            currentGradient,
            currentGradientName,
            '',
            0
          )
          // checks
          // console.log('Current Gradient')
          // console.log(gradientStylesCheck)
          // console.log('Gradient List')
          // console.log(gradientStyles)
          // console.log(isDeepStrictEqual(gradientStyles, gradientStylesCheck))
          //

          if (!checkToken(currentGradient, gradientStyles)) {
            createCouples(
              gradientStyles,
              currentGradient,
              currentGradientName,
              '',
              0
            )
          }
        }
      }
    }
    // #endregion

    for (const style of layerStyles) {
      let currentStyle = style.name

      let styleColors = {}
      let styleBorderColors = {}
      let styleBorderPosition = {}
      let styleBorderSize = {}
      let styleShadowToken = false
      let styleShadow = {}
      let styleInnerShadows = {}

      // #region checks
      // if (currentStyle == 'Blue Fill') {
      //   console.log('Fill:')
      //   console.log(style.value.fills)
      // }
      // if (currentStyle == 'Gradient Linear') {
      //   console.log('Gradient Linear:')
      //   console.log(style.value.fills)
      //   // for (const fill of style.value.fills) {
      //   //   // console.log(fill.gradient.gradientType)
      //   //   // console.log(fill.gradient.stops)
      //   //   console.log(fill.gradient.from.split(',')[0].replace('{', ''))
      //   //   console.log(fill.gradient.from.split(',')[1].replace('}', ''))
      //   //   console.log(fill.gradient.to)
      //   //   let degree = getAngleDeg(
      //   //     fill.gradient.from.split(',')[0].replace('{', ''),
      //   //     fill.gradient.from.split(',')[1].replace('}', ''),
      //   //     fill.gradient.to.split(',')[0].replace('{', ''),
      //   //     fill.gradient.to.split(',')[1].replace('}', '')
      //   //   )
      //   //   console.log(Math.round(degree))
      //   // }
      // }
      // if (currentStyle == 'Gradient Radial') {
      //   console.log('Gradient Radial:')
      //   console.log(style.value.fills)
      //   // for (const fill of style.value.fills) {
      //   //   // console.log(fill.gradient.gradientType)
      //   //   // console.log(fill.gradient.stops)
      //   //   console.log(fill.gradient.from.split(',')[0].replace('{', ''))
      //   //   console.log(fill.gradient.from.split(',')[1].replace('}', ''))
      //   //   console.log(fill.gradient.to)
      //   //   let degree = getAngleDeg(
      //   //     fill.gradient.from.split(',')[0].replace('{', ''),
      //   //     fill.gradient.from.split(',')[1].replace('}', ''),
      //   //     fill.gradient.to.split(',')[0].replace('{', ''),
      //   //     fill.gradient.to.split(',')[1].replace('}', '')
      //   //   )
      //   //   console.log(Math.round(degree))
      //   // }
      // }
      // if (currentStyle == 'Image') {
      //   console.log('Image:')
      //   for (const fill of style.value.fills) {
      //   }
      // }
      // #endregion

      // #region Fills check
      let fills = style.value.fills
      let counter = 1
      for (const fill of fills) {
        let fillType = fill.fillType
        // console.log(
        //   style.name +
        //     ' - Fill Type: ' +
        //     fillType +
        //     ' - Fill Gradient Type: ' +
        //     fill.gradient.gradientType
        // )
        let fillGradientStyles = {}
        if (fill.isEnabled) {
          let fillCount = ''
          if (counter > 1) {
            fillCount = counter.toString()
          }

          // #region fill monochrome
          if (fillType === 0) {
            let color = fill.color
            let currentColor = rgbHex(
              color.red * 255,
              color.green * 255,
              color.blue * 255,
              color.alpha
            )
            if (checkToken(colorTokens, currentColor) === false) {
              // createCouples(colorTokens, currentColor, "color", i);
              styleColors['background' + fillCount + '-color'] = currentColor
            } else {
              styleColors['background' + fillCount + '-color'] =
                variablePrefix + getKeyByValue(colorTokens, currentColor)
            }
          }
          // #endregion

          // #region fill gradient
          if (fillType === 1) {
            let currentGradient = {}
            let gradientType = fill.gradient.gradientType
            let gradientName = gradientTypeValue[gradientType]
            currentGradient = setGradientDetails(
              currentGradient,
              fill,
              gradientType,
              variablePrefix
            )

            let currentGradientName =
              gradientTypeValue[fill.gradient.gradientType]
            for (const [key, value] of Object.entries(gradientStyles)) {
              let gradientName = key
              let gradient = value
              if (
                isDeepStrictEqual(currentGradient, gradient) &&
                gradientName.includes(currentGradientName)
              ) {
                styleColors['background' + fillCount + '-color'] =
                  variablePrefix + gradientName
              }
            }
          }
          // #endregion

          // #region fill image
          if (fillType === 4) {
            // console.log(style.name)
            // console.log(fill.image)
            let patternType = imageFillType[fill.patternFillType]
            let patternScale = fill.patternTileScale

            styleColors['background-position'] = 'center'
            if (patternType === 'tile' && patternScale !== 1) {
              styleColors['background-size'] =
                (patternScale * 100).toString() + '%'
            } else if (patternType === 'stretch') {
              styleColors['background-size'] = 'cover'
            } else if (patternType === 'fit') {
              styleColors['background-size'] = 'contain'
            }
            if (fill.patternFillType === 0) {
              styleColors['background-repeat'] = 'repeat'
            } else {
              styleColors['background-repeat'] = 'no-repeat'
            }
            styleColors['background-image'] = fill.image._ref
          }
          // #endregion
          counter++
        }
      }
      // #endregion

      //reset the counter
      counter = 1

      // #region Borders check
      let borders = style.value.borders
      for (const border of borders) {
        if (border.isEnabled) {
          let fillCount = ''
          if (counter > 1) {
            fillCount = counter.toString()
          }
          // Colors
          let color = border.color
          // console.log(border)
          let currentColor = rgbHex(
            color.red * 255,
            color.green * 255,
            color.blue * 255,
            color.alpha
          )
          if (checkToken(colorTokens, currentColor) === false) {
            styleBorderColors['border' + fillCount + '-color'] = currentColor
          } else {
            styleBorderColors['border' + fillCount + '-color'] =
              variablePrefix + getKeyByValue(colorTokens, currentColor)
          }

          // Position
          styleBorderPosition['border' + fillCount + '-position'] =
            borderPosition[border.position]

          // Size
          styleBorderSize['border' + fillCount + '-size'] =
            border.thickness.toString() + 'px'

          counter++
        }
      }
      // #endregion

      //reset the counter
      counter = 1
      // #region Shadows check
      let shadows = style.value.shadows
      for (const shadow of shadows) {
        if (shadow.isEnabled) {
          let currentShadow = {}
          let shadowCount = ''
          if (counter > 1) {
            shadowCount = '-' + counter.toString()
          }
          let color = shadow.color
          let currentColor = rgbHex(
            color.red * 255,
            color.green * 255,
            color.blue * 255,
            color.alpha
          )

          if (!checkToken(colorTokens, currentColor)) {
            currentShadow['shadow-color'] = currentColor
          } else {
            currentShadow['shadow-color'] = getKeyByValue(
              colorTokens,
              currentColor
            )
          }
          currentShadow['shadow-blur-radius'] = shadow.blurRadius
          currentShadow['shadow-offset-x'] = shadow.offsetX
          currentShadow['shadow-offset-y'] = shadow.offsetY
          currentShadow['shadow-spread'] = shadow.spread
          if (!checkToken(currentShadow, shadowStyles)) {
            styleShadow['shadow' + shadowCount] =
              variablePrefix +
              getKeyByValueObj(shadowStyles, currentShadow, variablePrefix)
          }

          counter++
        }
      }
      // #endregion

      //reset the counter
      counter = 1

      // #region Inner Shadows check
      let innerShadows = style.value.innerShadows
      for (const shadow of innerShadows) {
        if (shadow.isEnabled) {
          let currentShadow = {}
          let shadowCount = ''
          if (counter > 1) {
            shadowCount = counter.toString()
          }
          let color = shadow.color
          let currentColor = rgbHex(
            color.red * 255,
            color.green * 255,
            color.blue * 255,
            color.alpha
          )

          if (!checkToken(colorTokens, currentColor)) {
            currentShadow['inner-shadow-color'] = currentColor
          } else {
            currentShadow['inner-shadow-color'] = getKeyByValue(
              colorTokens,
              currentColor
            )
          }

          currentShadow['inner-shadow-blur-radius'] = shadow.blurRadius
          currentShadow['inner-shadow-offset-x'] = shadow.offsetX
          currentShadow['inner-shadow-offset-y'] = shadow.offsetY
          currentShadow['inner-shadow-spread'] = shadow.spread

          if (!checkToken(currentShadow, innerShadowStyles)) {
            styleInnerShadows['inner-shadow' + shadowCount] =
              variablePrefix +
              getKeyByValueObj(innerShadowStyles, currentShadow, variablePrefix)
          }

          counter++
        }
      }
      // #endregion

      //reset the counter
      counter = 1

      // manage the entire layer style
      layerStylesTokensList = Object.assign(
        styleColors,
        styleBorderColors,
        styleBorderPosition,
        styleBorderSize,
        styleShadow,
        styleInnerShadows
      )

      if (currentStyle.indexOf('/') > -1) {
        createNestedObject(
          layerStyleTokens,
          currentStyle.split('/'),
          layerStylesTokensList
        )
      } else {
        layerStyleTokens[currentStyle] = layerStylesTokensList
      }
    }
    // #endregion

    // #region Text Styles
    const textStyles = document.layerTextStyles.objects.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true })
    )

    const textDecorationsOptions = ['none', 'underline', 'strikethrough']

    const textCasesOptions = ['none', 'uppercase', 'lowercase', 'capitalize']

    const textAlignmentOptions = ['left', 'right', 'center']

    let fonts = {}

    let fontSize = {}
    let fontWeight = {}
    let fontAlignment = {}
    let fontVAlignment = {}
    let fontKerning = {}
    let fontLineHeight = {}
    let fontParagraphSpacing = {}
    let textTransform = {}
    let fontAxes = {}

    let textStylesTokensList = {}
    let textStyleTokens = {}

    let textStylesComplete = false

    // #region Font Sizes tokens (because of ordering)
    // future options: add XS-S-M-L-XL...as an option
    let sizeValues = []
    for (const textStyleForSize of textStyles) {
      let size =
        textStyleForSize.value.textStyle.encodedAttributes
          .MSAttributedStringFontAttribute.attributes.size
      if (sizeValues.length > 0) {
        if (sizeValues.indexOf(size) > -1) {
        } else {
          sizeValues.push(size)
        }
      } else {
        sizeValues.push(size)
      }
    }
    if (sizeValues.length > 0) {
      sizeValues = sizeValues.sort(function (a, b) {
        return a - b
      })
      for (let i = 0; i < sizeValues.length; i++) {
        let counter = i + 1
        createCouples(fontSize, sizeValues[i], 'font-size', counter.toString())
      }
    }
    // #endregion

    // Check and list all the variants
    let counter = 1
    for (const textStyle of textStyles) {
      let fontFamily = []
      let styleFontFamily
      let styleFontFamilyName = {}
      let styleFontSize = {}
      let styleFontForcedStyle
      let styleFontColor
      let styleFontWeight = {}
      let styleFontAlignment
      let styleFontVAlignment
      let styleFontKerning
      let styleFontLineHeight
      let styleFontParagraphSpacing
      let styleTextTransform
      let styleFontAxes

      let currentStyle = textStyle.name

      // #region Font Family
      let currentStyleFont =
        textStyle.value.textStyle.encodedAttributes
          .MSAttributedStringFontAttribute.attributes.name
      let currentStyleFontKey = currentStyleFont
      if (currentStyleFont.indexOf(' ') > -1) {
        if (currentStyleFont.indexOf(separator) > -1) {
          currentStyleFontKey = currentStyleFont.replaceAll(' ', '')
        } else {
          currentStyleFontKey = currentStyleFont.replaceAll(' ', separator)
        }
      }
      fontFamily = currentStyleFont.split('-')
      createCouples(
        fonts,
        currentStyleFont,
        '$font-family',
        currentStyleFontKey
      )
      styleFontFamily = setStyleToken(fonts, currentStyleFont, 'font-family')
      styleFontFamilyName['font-family-name'] = fontFamily[0]
      //console.log(styleFontFamily)
      // #endregion

      // #region Font Size
      let currentStyleFontSize =
        textStyle.value.textStyle.encodedAttributes
          .MSAttributedStringFontAttribute.attributes.size
      styleFontSize = setStyleToken(
        fontSize,
        currentStyleFontSize,
        'font-size',
        variablePrefix
      )
      // console.log(styleFontSize)
      // #endregion

      // #region Font Color
      let currentStyleFontColor =
        textStyle.value.textStyle.encodedAttributes
          .MSAttributedStringColorAttribute
      let currentColor = rgbHex(
        currentStyleFontColor.red * 255,
        currentStyleFontColor.green * 255,
        currentStyleFontColor.blue * 255,
        currentStyleFontColor.alpha
      )
      // If the color already exist as a Color Variable, it should not be added
      if (checkToken(colorTokens, currentColor) === false) {
        createCouples(colorTokens, currentColor, 'color', counter.toString())
      }
      styleFontColor = setStyleToken(
        colorTokens,
        currentColor,
        'text-color',
        variablePrefix
      )
      // #endregion

      // #region Font Weight
      // // todo: manage the tokenization of names (XS, S, M, L, XL)
      // let currentStyleFontWeight = textStyle.fontWeight * 100
      // createCouples(
      //   fontWeight,
      //   currentStyleFontWeight,
      //   'font-weight',
      //   currentStyleFontWeight
      // )
      // styleFontWeight = setStyleToken(
      //   fontWeight,
      //   currentStyleFontWeight,
      //   'font-weight'
      // )
      if (fontFamily[1] !== undefined) {
        styleFontWeight['font-weight'] = fontFamily[1]
      } else {
        styleFontWeight['font-weight'] = 'Regular'
      }
      // #endregion

      // #region Text Alignment
      if (
        textStyle.value.textStyle.encodedAttributes.paragraphStyle !== undefined
      ) {
        if (
          textStyle.value.textStyle.encodedAttributes.paragraphStyle
            .alignment !== undefined
        ) {
          let currentStyleFontAlignment =
            textStyle.value.textStyle.encodedAttributes.paragraphStyle.alignment
          let forcedAlignment = textAlignmentOptions[currentStyleFontAlignment]
          createCouples(
            fontAlignment,
            forcedAlignment,
            'text-align',
            forcedAlignment
          )
          styleFontAlignment = setStyleToken(
            fontAlignment,
            forcedAlignment,
            'text-align',
            variablePrefix
          )
        }
      } else {
        createCouples(fontAlignment, 'left', 'text-align', 'left')
        styleFontAlignment = setStyleToken(
          fontAlignment,
          'left',
          'text-align',
          variablePrefix
        )
      }
      // #endregion

      // #region Other text parameters
      // // Text Vertical Alignment
      // let currentStyleFontVAlignment = textStyle.verticalAlignment
      // createCouples(
      //   fontVAlignment,
      //   currentStyleFontVAlignment,
      //   'text-valign',
      //   currentStyleFontVAlignment
      // )
      // styleFontVAlignment = setStyleToken(
      //   fontVAlignment,
      //   currentStyleFontVAlignment,
      //   'text-valign'
      // )
      // // Text Kerning
      // let currentStyleFontKerning = textStyle.kerning
      // if (textStylesComplete) {
      //   createCouples(
      //     fontKerning,
      //     currentStyleFontKerning,
      //     'text-kerning',
      //     currentStyleFontKerning
      //   )
      // }
      // styleFontKerning = setStyleToken(
      //   fontKerning,
      //   currentStyleFontKerning,
      //   'text-kerning'
      // )
      // // Text Line Height
      // let currentStyleFontLineHeight = textStyle.lineHeight
      // if (textStylesComplete) {
      //   createCouples(
      //     fontLineHeight,
      //     currentStyleFontLineHeight,
      //     'text-line-height',
      //     currentStyleFontLineHeight
      //   )
      // }
      // styleFontLineHeight = setStyleToken(
      //   fontLineHeight,
      //   currentStyleFontLineHeight,
      //   'text-line-height'
      // )
      // // Text Paragraph Spacing
      // let currentStyleFontParagraphSpacing =
      //   textStyle.paragraphSpacing
      // if (textStylesComplete) {
      //   createCouples(
      //     fontParagraphSpacing,
      //     currentStyleFontParagraphSpacing,
      //     'text-paragraph',
      //     currentStyleFontParagraphSpacing
      //   )
      // }
      // styleFontParagraphSpacing = setStyleToken(
      //   fontParagraphSpacing,
      //   currentStyleFontParagraphSpacing,
      //   'text-paragraph'
      // )
      // // Text Transforma
      // let currentStyleTextTransform = textStyle.textTransform
      // if (textStylesComplete) {
      //   createCouples(
      //     textTransform,
      //     currentStyleTextTransform,
      //     'text-transform',
      //     currentStyleTextTransform
      //   )
      // }
      // styleTextTransform = setStyleToken(
      //   textTransform,
      //   currentStyleTextTransform,
      //   'text-transform'
      // )
      // // Text Font Axes
      // let currentStyleFontAxes = textStyle.fontAxes
      // if (textStylesComplete) {
      //   createCouples(
      //     fontAxes,
      //     currentStyleFontAxes,
      //     'text-axes',
      //     currentStyleFontAxes
      //   )
      // }
      // styleFontAxes = setStyleToken(fontAxes, currentStyleFontAxes, 'text-axes')
      // #endregion

      // manage the entire text style
      textStylesTokensList = Object.assign(
        styleFontFamily,
        styleFontFamilyName,
        styleFontWeight,
        styleFontSize,
        styleFontColor,
        styleFontAlignment,
        styleFontVAlignment,
        styleFontKerning,
        styleFontLineHeight,
        styleFontParagraphSpacing,
        styleTextTransform,
        styleFontAxes
      )

      if (currentStyle.indexOf('/') > -1) {
        createNestedObject(
          textStyleTokens,
          currentStyle.split('/'),
          textStylesTokensList
        )
      } else {
        textStyleTokens[currentStyle] = textStylesTokensList
      }
      counter++
    }
    // #endregion

    // #region Create the final Object to be converted in a JSON file
    // 1. Order the Gradient Styles Descending by Key
    gradientStyles = Object.keys(gradientStyles)
      .sort()
      .reduce(function (result, key) {
        result[key] = gradientStyles[key]
        return result
      }, {})

    // 2. Create the Object
    let colorsObj = { colors: colorTokens }
    let gradientObj = { gradients: gradientStyles }
    let shadowsObj = { shadows: shadowStyles }
    let innerShadowsObj = { 'inner-shadows': innerShadowStyles }
    let fontsObj = { fonts: fonts }
    let fontSizeObj = { 'font-sizes': fontSize }
    let fontWeightObj = { 'font-weights': fontWeight }
    let fontAlignmentObj = { 'text-alignments': fontAlignment }
    let fontVAlignmentObj = { 'text-vertical-alignments': fontVAlignment }
    let fontKerningObj = {}
    let fontLineHeightObj = {}
    let fontParagraphSpacingObj = {}
    let textTransformObj = {}
    let fontAxesObj = {}
    if (textStylesComplete) {
      fontKerningObj = { 'text-kernings': fontKerning }
      fontLineHeightObj = { 'text-line-heights': fontLineHeight }
      fontParagraphSpacingObj = {
        'text-paragraph-spacings': fontParagraphSpacing,
      }
      textTransformObj = { 'text-transforms': textTransform }
      fontAxesObj = { 'text-axes': fontAxes }
    }
    let layerStylesObj = { 'layer-styles': layerStyleTokens }
    let textStylesObj = { 'text-styles': textStyleTokens }

    designTokensList = Object.assign(
      colorsObj,
      gradientObj,
      shadowsObj,
      innerShadowsObj,
      fontsObj,
      fontSizeObj,
      fontWeightObj,
      fontAlignmentObj,
      fontVAlignmentObj,
      fontKerningObj,
      fontLineHeightObj,
      fontParagraphSpacingObj,
      textTransformObj,
      fontAxesObj,
      layerStylesObj,
      textStylesObj
    )

    // #endregion

    if (Object.keys(designTokensList).length > 0) {
      //if (fonts.length > 0) {
      delete designTokensList[keyToDelete]
    }
    // console.log(json);

    // Finally, store the color information in a `colors.json` file:
    fs.writeFile(
      'design-tokens.json',
      JSON.stringify(designTokensList, null, 2),
      err => {
        if (err) throw err
        console.log('✅ Design Tokens extraction complete')
      }
    )

    // ...and finally, save the file back to disk
    // toFile(parsedFile).then(() => {
    //   console.log('✅ File saved successfully.')
    // })
  }
)

function checkToken(object, currentItem) {
  let check = false
  if (Object.keys(object).length > 0) {
    if (Object.values(object).indexOf(currentItem) > -1) {
      check = true
    }
  }
  return check
}

function getKeyByValue(object, value, discard = '') {
  if (typeof value === 'string') {
    value = value.replace(discard, '')
  }
  return Object.keys(object).find(key => object[key] === value)
}

function getKeyByValueObj(object, value, discard = '') {
  return Object.keys(object).find(key => {
    return (
      JSON.stringify(object[key]).replace(discard, '') ===
      JSON.stringify(value).replace(discard, '')
    )
  })
}

function createCouples(
  object,
  currentItem,
  name = '',
  i = '',
  suffixNeeded = 1
) {
  // if null we need something different
  if (currentItem === null) {
    currentItem = 'auto'
    i = 'auto'
  }

  let suffix = '-' + i
  if (suffixNeeded === 0) {
    suffix = ''
  }
  let keyName = name + suffix
  if (Object.keys(object).length > 0) {
    if (Object.values(object).indexOf(currentItem) > -1) {
      // This item already exists
    } else {
      // This item is new
      object[keyName] = currentItem
    }
  } else {
    // This item is the first one I evaluate
    object[keyName] = currentItem
  }
}

function setStyleToken(object, currentItem, key = '', prefix = '') {
  let token = {}
  if (checkToken(object, currentItem)) {
    token[key] = prefix + getKeyByValue(object, currentItem)
  } else {
    token[key] = prefix + currentItem
  }
  return token
}

function createNestedObject(object, keys, value) {
  // If a value is given, remove the last name and keep it for later:
  var lastKey = arguments.length === 3 ? keys.pop() : false
  // Walk the hierarchy, creating new objects where needed.
  // If the lastKey was removed, then the last object is not set yet:
  for (var i = 0; i < keys.length; i++) {
    object = object[keys[i]] = object[keys[i]] || {}
  }

  // If a value was given, set it to the last name:
  if (lastKey) object = object[lastKey] = value

  // Return the last object in the hierarchy:
  return object
}
// Usages:
// createNestedObject(window, ['shapes', 'circle'])
// // Now window.shapes.circle is an empty object, ready to be used.
// var object = {} // Works with any object other that window too
// createNestedObject(object, ['shapes', 'rectangle', 'width'], 300)
// // Now we have: object.shapes.rectangle.width === 300
// createNestedObject(object, 'shapes.rectangle.height'.split('.'), 400)
// Now we have: object.shapes.rectangle.height === 400

function getKey(object, val) {
  Object.keys(object).find(key => object[key] === val)
}

function getAngleDeg(ax, ay, bx, by) {
  var angleRad = Math.atan((ay - by) / (ax - bx))
  var angleDeg = (angleRad * 180) / Math.PI

  return angleDeg
}

// Internal functions
// Set Color Token
function setColorToken(object, currentItem, key, internalObject = undefined) {
  let color = currentItem.color
  let currentColor = rgbHex(
    color.red * 255,
    color.green * 255,
    color.blue * 255,
    color.alpha
  )
  let currentObject = {}
  if (internalObject !== undefined) {
    currentObject = internalObject
  }
  if (checkToken(colorTokens, currentColor) === false) {
    createCouples(currentObject, currentColor, 'color', '', 0)
    object[key] = currentObject
  } else {
    createCouples(
      currentObject,
      getKeyByValue(colorTokens, currentColor),
      'color',
      '',
      0
    )
    object[key] = currentObject
  }
}

// Set Gradients
function setGradientDetails(object, currentItem, type = 0, prefix = '') {
  let currentObject = {}
  let fill = currentItem

  if (type === 1) {
    if (fill.gradient.elipseLength > 0) {
      object['type'] = gradientCircleType[1]
    } else {
      object['type'] = gradientCircleType[0]
    }
  }
  let degree = Math.round(
    getAngleDeg(
      fill.gradient.from.split(',')[0].replace('{', ''),
      fill.gradient.from.split(',')[1].replace('}', ''),
      fill.gradient.to.split(',')[0].replace('{', ''),
      fill.gradient.to.split(',')[1].replace('}', '')
    )
  ).toString()
  currentObject['degree'] = degree

  let stops = fill.gradient.stops
  let stopCounter = 1
  let stopList = {}
  for (const stop of stops) {
    let currentStop = {}
    let stopName = stopCounter.toString()
    let currentColor = ''
    let currentPosition = 0
    // Define Color -> Not use the Function, as we need to set a bigger object for steps
    let color = stop.color
    currentColor = rgbHex(
      color.red * 255,
      color.green * 255,
      color.blue * 255,
      color.alpha
    )
    currentPosition = Math.round(stop.position * 100) / 100
    if (checkToken(colorTokens, currentColor) === false) {
      currentStop = Object.assign(currentStop, { color: currentColor })
    } else {
      currentStop = Object.assign(currentStop, {
        color: prefix + getKeyByValue(colorTokens, currentColor),
      })
    }
    currentStop = Object.assign(currentStop, {
      position: currentPosition,
    })
    createNestedObject(stopList, [stopName], currentStop)
    stopCounter++
  }
  createCouples(currentObject, stopList, 'stops', '', 0)
  return currentObject
}
