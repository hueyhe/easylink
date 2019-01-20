# easylink
Quick link or unlink projects with yarn.

## Install
```bash
$ yarn add easylink -D
```

## Configuration
Add `.linkrc.json` file under the root directory of your project.

### Example
```json
{
  "react": {
    "localPath": "path/to/forked/react",
    "workspace": [
      ".", // Current project
      "path/to/other/project"
    ]
  },
  "other-module": { ... }
}
```

## Usage
```bash
$ ./node_modules/.bin/easylink [--reset]
```
