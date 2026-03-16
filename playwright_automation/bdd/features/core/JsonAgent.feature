@json_agent
Feature: JSON Agent Creation Flow

  # Flow: Login → Domain config → Create workflow → Properties (name + description only)
  #       → JSON View (paste JSON, sync, close) → Run → Chat

  Background:
    Given I have a valid QI Studio session (login and domain configured)

  @smoke
  Scenario: Create an Agent via JSON and test it
    # 1. Create new workflow
    When I navigate to Agentic Orchestrations
    And I click to Create a new agent workflow

    # 2. Properties panel - wait for load, enter name + description, close, save
    And I wait for the properties panel to load
    When I set the agent name to "JSON Agent"
    And I set the agent description to "Agent created via JSON paste"
    And I close the properties panel
    And I save the properties panel

    # 3. JSON View - paste JSON, sync, close
    Then the orchestration canvas should be visible
    When I open the JSON editor
    And I paste the agent JSON from "bdd/data/core/agent_testcase1.json"
    And I click Sync changes
    And I close the JSON editor

    # 4. Save, then Run and chat
    And I save the agent workflow
    And I run the agent workflow
    Then the chat interface should be visible
    When I type and send message "Hi" in the chat
    Then I receive a response in the chat

  @json_agent @agent_creation @regression
  Scenario: Create Agent via JSON - agent creation
    When I navigate to Agentic Orchestrations
    And I click to Create a new agent workflow
    And I wait for the properties panel to load
    When I set the agent name to "agent creation"
    And I set the agent description to "testcase1"
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
    When I type and send message "Hi" in the chat
    Then I receive a response in the chat

  @json_agent @system_tools @regression
  Scenario: Create Agent via JSON - system tools
    When I navigate to Agentic Orchestrations
    And I click to Create a new agent workflow
    And I wait for the properties panel to load
    When I set the agent name to "system tools"
    And I set the agent description to "testcase2"
    And I close the properties panel
    And I save the properties panel
    Then the orchestration canvas should be visible
    When I open the JSON editor
    And I paste the agent JSON from "bdd/data/tools/system_tools_testcase1.json"
    And I click Sync changes
    And I close the JSON editor
    And I save the agent workflow
    And I run the agent workflow
    Then the chat interface should be visible
    When I type and send message "Hi" in the chat
    Then I receive a response in the chat

  @json_agent @shared_tools @regression
  Scenario: Create Agent via JSON - shared tools
    When I navigate to Agentic Orchestrations
    And I click to Create a new agent workflow
    And I wait for the properties panel to load
    When I set the agent name to "shared tools"
    And I set the agent description to "testcase3"
    And I close the properties panel
    And I save the properties panel
    Then the orchestration canvas should be visible
    When I open the JSON editor
    And I paste the agent JSON from "bdd/data/tools/shared_tools_testcase1.json"
    And I click Sync changes
    And I close the JSON editor
    And I save the agent workflow
    And I run the agent workflow
    Then the chat interface should be visible
    When I type and send message "Hi" in the chat
    Then I receive a response in the chat
    
  @json_agent @llm_node @regression
  Scenario: Create Agent via JSON - llm node
    When I navigate to Agentic Orchestrations
    And I click to Create a new agent workflow
    And I wait for the properties panel to load
    When I set the agent name to "llm node"
    And I set the agent description to "testcase4"
    And I close the properties panel
    And I save the properties panel
    Then the orchestration canvas should be visible
    When I open the JSON editor
    And I paste the agent JSON from "bdd/data/core/llm_testcase1.json"
    And I click Sync changes
    And I close the JSON editor
    And I save the agent workflow
    And I run the agent workflow
    Then the chat interface should be visible
    When I type and send message "Hi" in the chat
    Then I receive a response in the chat  
