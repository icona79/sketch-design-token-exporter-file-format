# Sketch Design Tokens exporter

This tool permit you to export from a Sketch document a list of Design Tokens compatible with Amazon Style Dictionary

## Script details

[TBD]

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

### Options

The script load by default the `testKit.sketch`
It is possible to analyze any Sketch document via parameter (`npm start path_to_file`) or by placing a document named `Tokens.sketch` in your Desktop folder.
