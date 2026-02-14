import { useListBuilder } from "@/hooks/use-list-builder";
import { SearchFilters } from "@/components/list-builder/SearchFilters";
import { ResultsTable } from "@/components/list-builder/ResultsTable";
import { Search } from "lucide-react";

export default function ListBuilder() {
  const lb = useListBuilder();

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Search className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">List Builder</h1>
            <p className="text-sm text-muted-foreground">
              Search your database to find and export targeted prospect lists
            </p>
          </div>
        </div>
      </div>

      {/* Main content: filters sidebar + results */}
      <div className="flex-1 flex min-h-0">
        {/* Filters sidebar */}
        <div className="w-[320px] border-r flex-shrink-0 flex flex-col">
          <SearchFilters
            filters={lb.filters}
            setFilters={lb.setFilters}
            onSearch={lb.search}
            onReset={lb.resetFilters}
            isLoading={lb.isLoading}
          />
        </div>

        {/* Results */}
        <div className="flex-1 flex flex-col min-w-0">
          <ResultsTable
            results={lb.results}
            totalAccounts={lb.totalAccounts}
            isLoading={lb.isLoading}
            selectedIds={lb.selectedIds}
            toggleSelect={lb.toggleSelect}
            selectAll={lb.selectAll}
            clearSelection={lb.clearSelection}
            exportCsv={lb.exportCsv}
            page={lb.page}
            setPage={lb.setPage}
            pageSize={lb.pageSize}
            searchTriggered={lb.searchTriggered}
          />
        </div>
      </div>
    </div>
  );
}
