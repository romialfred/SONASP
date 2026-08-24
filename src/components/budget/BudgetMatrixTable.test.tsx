import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BudgetMatrixTable } from './BudgetMatrixTable';

describe('BudgetMatrixTable', () => {
  it('présente la matrice comme une prévision avec des libellés métier sobres', () => {
    render(
      <BudgetMatrixTable
        mode="budget"
        selectedQuarter={null}
        monthlyBudgets={[]}
        quarterlyForecasts={[]}
        pendingBudgets={{}}
        pendingForecasts={{}}
        onBudgetChange={vi.fn()}
        onForecastChange={vi.fn()}
        expandedQuarters={{ 1: true, 2: false, 3: false, 4: false }}
        onToggleQuarter={vi.fn()}
      />
    );

    expect(screen.getByText('Prévision (oz)')).toBeInTheDocument();
    expect(screen.getByText('Trimestre 1')).toBeInTheDocument();
    expect(screen.queryByText(/Budget/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Forecast/i)).not.toBeInTheDocument();
  });
});
