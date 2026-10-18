import {
  ResourceTable,
  type ResourceTableLabels,
  type ResourceTablePaginationState,
  type ResourceTableProps,
} from '@a3s-lab/ui';
import { useI18n } from '@/i18n/useI18n';

/** Default page size for Console list tables. */
export const CONSOLE_TABLE_PAGE_SIZE = 10;

/** Shared page-size choices for Console DataTables. */
export const CONSOLE_TABLE_PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

export const CONSOLE_TABLE_DEFAULT_PAGINATION: ResourceTablePaginationState = {
  page: 1,
  pageSize: CONSOLE_TABLE_PAGE_SIZE,
};

/**
 * ResourceTable with Console locale + sensible list pagination defaults.
 * Prefer this over importing ResourceTable directly from `@a3s-lab/ui` in product pages.
 *
 * ConsolePagination is on by default (via `@a3s-lab/ui` ResourceTable). Opt out with
 * `showPagination={false}` for tiny embedded tables. Override `pageSize` /
 * `pageSizeOptions` when a surface needs denser or sparser paging (e.g. Users).
 */
export function I18nDataTable<T>(props: ResourceTableProps<T>) {
  const { t } = useI18n();
  const labels: ResourceTableLabels = {
    zeroResults: t('table.zeroResults'),
    range: t('table.range'),
    rows: t('table.rows'),
    rowsPerPage: t('table.rowsPerPage'),
    columnFilters: t('table.columnFilters'),
    refresh: t('table.refresh'),
    filterColumn: t('table.filterColumn'),
  };

  const {
    defaultPagination,
    pageSizeOptions,
    showPagination,
    labels: labelsProp,
    ...rest
  } = props;

  return (
    <ResourceTable
      {...rest}
      showPagination={showPagination}
      defaultPagination={
        showPagination === false
          ? defaultPagination
          : (defaultPagination ?? CONSOLE_TABLE_DEFAULT_PAGINATION)
      }
      pageSizeOptions={
        pageSizeOptions ?? [...CONSOLE_TABLE_PAGE_SIZE_OPTIONS]
      }
      labels={{ ...labels, ...labelsProp }}
    />
  );
}
