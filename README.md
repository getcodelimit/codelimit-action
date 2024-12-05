# Code Limit GitHub Action

<div align="center">

![Logo](docs/logo.png)

</div>

<div align="center">

  *Your Refactoring Alarm 🔔 As a GitHub Action*

</div>

<div align="center">

[![main](https://github.com/getcodelimit/codelimit-action/actions/workflows/main.yml/badge.svg)](https://github.com/getcodelimit/codelimit-action/actions/workflows/main.yml)
[![Checked with Code Limit](https://github.com/getcodelimit/codelimit-action/blob/_codelimit_reports/main/badge.svg)](https://github.com/getcodelimit/codelimit-action/blob/_codelimit_reports/main/codelimit.md)

</div>

To run Code Limit on every push and before every merge to main, append it to
your GH Action workflow:

```yaml
name: 'main'

on:
  push:
    branches: 
      - main
  pull_request:
    branches: 
      - main

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - name: 'Checkout sources'
        uses: actions/checkout@v4

      - name: 'Run Code Limit'
        uses: getcodelimit/codelimit-action@v1
```

## Adding exclude paths

```yaml
      - name: 'Run Code Limit'
        uses: getcodelimit/codelimit-action@v1
        with:
            excludes:
            - examples
            - third_party
```
