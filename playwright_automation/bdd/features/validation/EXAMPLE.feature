@llm_example @regression
Feature: Unified JSON Agent Creation and LLM Validation

  Background:
    Given I have a valid QI Studio session (login and domain configured)

  @example_scenario
  Scenario: Create a Procurement Agent from JSON and validate conversation semantically
    # 1. Start from JSON: Automatically navigates, creates, and pastes the agent JSON
    When I navigate to Agentic Orchestrations
    And I click to Create a new agent workflow
    And I wait for the properties panel to load
    When I set the agent name to "Unified Procurement Agent"
    And I set the agent description to "E2E semantic validation test"
    And I close the properties panel
    And I save the properties panel
    Then the orchestration canvas should be visible
    When I open the JSON editor
    And I paste the agent JSON from "bdd/data/core/agent_creation_testcase1.json"
    And I click Sync changes
    And I close the JSON editor
    And I save the agent workflow
    And I run the agent workflow
    Then the chat interface should be visible

    # 3. LLM Validation (N-Turns): 
    # - Loads 2-3 queries from the JSON file
    # - LLM generates the "Expected Intent" for each query
    # - Test waits for API Status 200 and UI Typing to stop
    # - LLM Judge scores the result against the Intent
    Given I load conversation turns from "bdd/data/validation/semantic-turns.json"
    Then the agent conversation should match the loaded turns
