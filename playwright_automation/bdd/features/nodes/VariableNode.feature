@nodes @variable_node
Feature: Variable Node

  Background:
    Given I have a valid QI Studio session (login and domain configured)

  @smoke @regression
  Scenario: Variable Node - Invoice calculation for year 2020
    When I navigate to Agentic Orchestrations
    And I click to Create a new agent workflow
    And I wait for the properties panel to load
    When I set the agent name to "Variable Node Agent 2020"
    And I set the agent description to "test variable node >= 2020"
    And I close the properties panel
    And I save the properties panel
    Then the orchestration canvas should be visible
    When I open the JSON editor
    And I paste the agent JSON from "bdd/data/nodes/variable-node/variable_testcase1.json"
    And I click Sync changes
    And I close the JSON editor
    And I save the agent workflow
    And I run the agent workflow
    Then the chat interface should be visible
    # Run Validation
    When I start intercepting the chat API response
    And I send and track message "Financial year 2020" in the chat
    Then the chat API response status should be 200
    # LLM Validation
    And I capture the agent response text
    And the LLM response should be validated by LLM judge for intent "To confirm: you asked for financial year 2020, but the instruction I have is to calculate invoice details for years greater than 2020."

  @regression
  Scenario: Variable Node - Invoice calculation for year 2018
    When I navigate to Agentic Orchestrations
    And I click to Create a new agent workflow
    And I wait for the properties panel to load
    When I set the agent name to "Variable Node Agent 2018"
    And I set the agent description to "test variable node < 2020"
    And I close the properties panel
    And I save the properties panel
    Then the orchestration canvas should be visible
    When I open the JSON editor
    And I paste the agent JSON from "bdd/data/nodes/variable-node/variable_testcase1.json"
    And I click Sync changes
    And I close the JSON editor
    And I save the agent workflow
    And I run the agent workflow
    Then the chat interface should be visible
    # Run Validation
    When I start intercepting the chat API response
    And I send and track message "Financial year 2018" in the chat
    Then the chat API response status should be 200
    # LLM Validation
    And I capture the agent response text
    And the LLM response should be validated by LLM judge for intent "invoice details for financial year 2018"
