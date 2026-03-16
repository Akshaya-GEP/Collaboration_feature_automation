@nodes @llm_node
Feature: LLM Node Validation
  
  # Validates prompt execution and model routing logic.

  Background:
    Given I have a valid QI Studio session (login and domain configured)

  @smoke
  Scenario: LLM Node - Successful Prompt Execution
    When I navigate to Agentic Orchestrations
    And I click to Create a new agent workflow
    And I wait for the properties panel to load
    When I set the agent name to "LLM Node"
    And I set the agent description to "test prompt execution"
    And I close the properties panel
    And I save the properties panel
    Then the orchestration canvas should be visible
    When I open the JSON editor
    And I paste the agent JSON from "bdd/data/nodes/llm-node/llm_testcase1.json"
    And I click Sync changes
    And I close the JSON editor
    And I save the agent workflow
    And I run the agent workflow
    Then the chat interface should be visible
    # Run Validation
    When I start intercepting the chat API response
    And I send and track message "Execute standard prompt" in the chat
    Then the chat API response status should be 200
    # LLM Validation
    And I capture the agent response text
    And the LLM response should be validated by LLM judge for intent "Successful prompt execution with helpful response"

  @llm_node @regression
  Scenario: LLM Node - Greeting response
    When I navigate to Agentic Orchestrations
    And I click to Create a new agent workflow
    And I wait for the properties panel to load
    When I set the agent name to "LLM Node Greeting"
    And I set the agent description to "test greeting"
    And I close the properties panel
    And I save the properties panel
    Then the orchestration canvas should be visible
    When I open the JSON editor
    And I paste the agent JSON from "bdd/data/nodes/llm-node/llm_testcase1.json"
    And I click Sync changes
    And I close the JSON editor
    And I save the agent workflow
    And I run the agent workflow
    Then the chat interface should be visible
    # Run Validation
    When I start intercepting the chat API response
    And I send and track message "Hello" in the chat
    Then the chat API response status should be 200
    # LLM Validation
    And I capture the agent response text
    And the LLM response should be validated by LLM judge for intent "Greeting"

  @llm_node @regression
  Scenario: LLM Node - Custom query validation
    When I navigate to Agentic Orchestrations
    And I click to Create a new agent workflow
    And I wait for the properties panel to load
    When I set the agent name to "LLM Node Custom"
    And I set the agent description to "custom query test"
    And I close the properties panel
    And I save the properties panel
    Then the orchestration canvas should be visible
    When I open the JSON editor
    And I paste the agent JSON from "bdd/data/nodes/llm-node/llm_testcase1.json"
    And I click Sync changes
    And I close the JSON editor
    And I save the agent workflow
    And I run the agent workflow
    Then the chat interface should be visible
    # Run Validation
    When I start intercepting the chat API response
    And I send and track message "What can you do?" in the chat
    Then the chat API response status should be 200
    # LLM Validation
    And I capture the agent response text
    And the LLM response should be validated by LLM judge for intent "Capabilities summary"

  @llm_node @step_map_demo @regression
  Scenario: LLM Node - Step Map demo (undefined steps for mapper)
    When I navigate to Agentic Orchestrations
    And I click to Create a new agent workflow
    And I wait for the properties panel to load
    When I set the agent name to "StepMap Demo"
    And I set the agent description to "demo for step mapper"
    And I close the properties panel
    And I save the properties panel
    Then the orchestration canvas should be visible
    When I open the JSON editor
    And I paste the agent JSON from "bdd/data/nodes/llm-node/llm_testcase1.json"
    And I click Sync changes
    And I close the JSON editor
    And I save the agent workflow
    And I run the agent workflow
    Then the chat interface should be visible
    # Run Validation & LLM Validation
    Then the agent response to "Tell me a joke" should pass validation with:
      | Rule           | Value     |
      | minLength      | 5         |
      | expectedIntent | humorous  |