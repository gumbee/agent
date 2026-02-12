# @gumbee/agent

## 1.4.0

### Minor Changes

- added observability dashboard to agent package

## 1.3.1

### Patch Changes

- infer yield types from middlewares in agents

## 1.3.0

### Minor Changes

- allow custom yields in middlewares to support domain specific events
- allow richer middleware descent conditions
- track usage per agent node
- track used models per agent node
- handle metadata injection into yielded events automatically

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
