# @gumbee/agent

## 1.2.0

### Minor Changes

- improved typesafety docs and defaults. Switched to an execution graph built up from stream events
- added customizable agent input schema and overridable execute method for agents to customize behaviour

## 1.1.0

### Minor Changes

- added TokenWindowMemory, SlidingWindowMemory
- switched agent loop steps to be 0-based instead of 1-based
- removed hard limit on agent loop counts (can execute indefinitely). Stop conditions are now the sole origin of stopping

## 1.0.0

### Major Changes

- initial release of agent package
