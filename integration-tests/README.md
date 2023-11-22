# Integration tests

The integration tests allow running the extension in a live VSCode
environment.

## Running the integration tests

First, follow the build instructions from the main README.md.
You also need to setup the Yocto project folder by downloading poky.
This can be done by running our `npm fetch:poky` script. It requires `curl` and
`tar` to be installed.

The npm script `test:integration` will run the integration tests.

It will run VSCode in headless mode. Make sure to have installed the dependency:
``` sh
apt install xvfb
```

## Debugging the integration tests

A VSCode launch task is provided to debug the integration tests: "Integration tests"

## More information

See the official documentation at https://code.visualstudio.com/api/working-with-extensions/testing-extension
