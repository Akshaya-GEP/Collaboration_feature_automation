@nodes @handoff_tool
Feature: Handoff Tool Node

  Background:
    Given I have a valid QI Studio session (login and domain configured)

  @smoke @regression
  Scenario: Handoff Tool - Branching to Category Agent
    When I navigate to Agentic Orchestrations
    And I click to Create a new agent workflow
    And I wait for the properties panel to load
    When I set the agent name to "Handoff Category Agent"
    And I set the agent description to "test handoff to category"
    And I close the properties panel
    And I save the properties panel
    Then the orchestration canvas should be visible
    When I open the JSON editor
    And I paste the agent JSON from "bdd/data/nodes/handoff-tool/handoff_tool_testcase1.json"
    And I click Sync changes
    And I close the JSON editor
    And I save the agent workflow
    And I run the agent workflow
    Then the chat interface should be visible
    # Run Validation & LLM Validation (Multi-turn)
    Given I load conversation turns from "bdd/data/nodes/handoff-tool/handoff_category_turns.json"
    Then the agent conversation should match the loaded turns

  @regression
  Scenario: Handoff Tool - Branching to Supplier Agent
    When I navigate to Agentic Orchestrations
    And I click to Create a new agent workflow
    And I wait for the properties panel to load
    When I set the agent name to "Handoff Supplier Agent"
    And I set the agent description to "test handoff to supplier"
    And I close the properties panel
    And I save the properties panel
    Then the orchestration canvas should be visible
    When I open the JSON editor
    And I paste the agent JSON from "bdd/data/nodes/handoff-tool/handoff_tool_testcase2.json"
    And I click Sync changes
    And I close the JSON editor
    And I save the agent workflow
    And I run the agent workflow
    Then the chat interface should be visible
    # Run Validation & LLM Validation (Multi-turn)
    Given I load conversation turns from "bdd/data/nodes/handoff-tool/handoff_supplier_turns.json"
    Then the agent conversation should match the loaded turns
