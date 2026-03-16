@run_validation
Feature: Run Workflow Validation via API

  # Flow: Login → Domain config → Create agent (JSON) → Save → Run → Chat ("Hi")
  #       → Intercept the chat API call → Assert response.status === 200

  Background:
    Given I have a valid QI Studio session (login and domain configured)

  @run_validation @run_validate_agent_creation @smoke
  Scenario: Run "agent creation" workflow and validate API response is 200
    # 1. Create agent
    When I navigate to Agentic Orchestrations
    And I click to Create a new agent workflow
    And I wait for the properties panel to load
    When I set the agent name to "agent creation"
    And I set the agent description to "run validation test"
    And I close the properties panel
    And I save the properties panel
    Then the orchestration canvas should be visible
    When I open the JSON editor
    And I paste the agent JSON from "bdd/data/core/agent_creation_testcase1.json"
    And I click Sync changes
    And I close the JSON editor

    # 2. Save and Run – start listening for the chat API call
    And I save the agent workflow
    And I run the agent workflow
    Then the chat interface should be visible

    # 3. Send "Hi" and capture API response
    When I start intercepting the chat API response
    And I type and send message "Hi" in the chat
    Then the chat API response status should be 200
    And I receive a response in the chat

  @run_validation @run_validate_system_tools @regression
  Scenario: Run "system tools" workflow and validate API response is 200
    # 1. Create agent
    When I navigate to Agentic Orchestrations
    And I click to Create a new agent workflow
    And I wait for the properties panel to load
    When I set the agent name to "system tools"
    And I set the agent description to "run validation test"
    And I close the properties panel
    And I save the properties panel
    Then the orchestration canvas should be visible
    When I open the JSON editor
    And I paste the agent JSON from "bdd/data/tools/system_tools_testcase1.json"
    And I click Sync changes
    And I close the JSON editor

    # 2. Save and Run – start listening for the chat API call
    And I save the agent workflow
    And I run the agent workflow
    Then the chat interface should be visible

    # 3. Send "Hi" and capture API response
    When I start intercepting the chat API response
    And I type and send message "Hi" in the chat
    Then the chat API response status should be 200
    And I receive a response in the chat
