# Setting up the Dev Env

- Run `yarn go` to initialize the project
- Run `yarn watch` for extension dev watch mode.
- Run `yarn test` to run the test suite.

## Updating the bundled JSON schemas

The schemas in `./schemas` are vendored from the `schemas` branch of
[origins-mod-json-schemas](https://github.com/SnaveSutit/origins-mod-json-schemas)
(itself a build output, published by that repo's CI on every push to main).
Run `yarn update-schemas` to re-fetch them after an upstream change, then
commit the result.
