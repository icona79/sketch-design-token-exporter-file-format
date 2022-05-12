# Sketch Design Tokens exporter

This tool permit you to export from a Sketch document a list of Design Tokens compatible with Amazon Style Dictionary

## Script details

A `design-tokens.json` file compatible with Amazon Style Dictionary will be created on your Desktop.

The code extracts from your defined Sketch document all your Color Variable, Layer Styles and Text Styles.

It also add some extra layer of Design Tokens, such as:

- Shadows
- Font Families
- Font Sizes
- Font Weights
- Text Alignments
- Border Positions

Each Design Token Layer is then used when requested in your Text and Layer styles.

All the references to an existent token is defined with a `$` sign:

For example:

```
"Black": {
  "background-color": {
    "value": "$Black"
  }
},
```

`$Black` refers to a previously generated Color Token defined into the `colors` section like:

```
"Black": {
  "value": "rgba(0, 0, 0, 1)"
},
```

### Options

The script load by default the `testKit.sketch`
It is possible to analyze any Sketch document via parameter (`npm start path_to_file`) or by placing a document named `Tokens.sketch` in your Desktop folder.

## Aknowledgments

Thanks to [Ale Munoz](https://github.com/bomberstudios) and [Francesco Bertocci](https://github.com/fbmore) for all their support :pray:

## Run the script

Optional, if you use `nvm` (highly recommended):

```bash
nvm install 17.8.0
nvm use # if you're using Codespaces, you'll need to run `nvm use --delete-prefix`
```

Install all the dependencies:

```bash
npm install
```

and run the project:

```bash
npm start
```
