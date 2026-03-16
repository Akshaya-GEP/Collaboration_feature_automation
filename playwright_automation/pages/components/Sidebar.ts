import type { Page } from '@playwright/test';

export class Sidebar {
  constructor(private readonly page: Page) {}

  private menuItem(name: string) {
    return this.page.getByRole('link', { name });
  }

  async goToDashboard() {
    await this.menuItem('Dashboard').click();
  }

  async goToAgents() {
    await this.menuItem('Agents').click();
  }

  async goToAgenticOrchestration() {
    await this.menuItem('Agentic orchestration').click();
  }

  async goToTools() {
    await this.menuItem('Tools').click();
  }
}
