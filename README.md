# CodeLimit GitHub Action

<div align="center">

![Logo](docs/logo.png)

</div>

<div align="center">

  *Your Refactoring Alarm 🔔 As a GitHub Action*

</div>

<div align="center">

[![main](https://github.com/getcodelimit/codelimit-action/actions/workflows/main.yml/badge.svg)](https://github.com/getcodelimit/codelimit-action/actions/workflows/main.yml)
[![codelimit](https://github.com/getcodelimit/codelimit-action/blob/_codelimit_reports/main/badge.svg?raw=true)](https://github.com/getcodelimit/codelimit-action/blob/_codelimit_reports/main/codelimit.md)

</div>

To run CodeLimit on every push and before every merge to main, append it to
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

      - name: 'Run CodeLimit'
        uses: getcodelimit/codelimit-action@v1
```
