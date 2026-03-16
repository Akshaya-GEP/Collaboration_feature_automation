@nodes @script_node
Feature: Script Node

  Background:
    Given I have a valid QI Studio session (login and domain configured)

  @smoke @regression
  Scenario: Script Node - Evaluation logic validation
    When I navigate to Agentic Orchestrations
    And I click to Create a new agent workflow
    And I wait for the properties panel to load
    When I set the agent name to "Script Node"
    And I set the agent description to "test script evaluation"
    And I close the properties panel
    And I save the properties panel
    Then the orchestration canvas should be visible
    When I open the JSON editor
    And I paste the agent JSON from "bdd/data/nodes/script-node/script_testcase1.json"
    And I click Sync changes
    And I close the JSON editor
    And I save the agent workflow
    And I run the agent workflow
    Then the chat interface should be visible
    # Run Validation
    When I start intercepting the chat API response
    And I send and track message "Help me with the evaluation" in the chat
    Then the chat API response status should be 200
    # LLM Validation
    And I capture the agent response text
    And the LLM response should pass structural validation with min length 20
    And the LLM response should be validated by LLM judge for intent "Guidance for attending the Final Technical Interview"
