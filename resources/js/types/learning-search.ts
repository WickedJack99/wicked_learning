export type LearningSearchResult =
    | {
          href: string;
          id: string;
          kind: 'topic';
          subtitle: string;
          title: string;
      }
    | {
          href: string;
          id: string;
          kind: 'map';
          mapId: number;
          mapSlug: string;
          subtitle: string;
          title: string;
      }
    | {
          href: string;
          id: string;
          kind: 'node';
          mapId: number;
          mapSlug: string;
          nodeId: number;
          nodeSlug: string;
          subtitle: string;
          title: string;
      };

export type LearningSearchPagination = {
    currentPage: number;
    lastPage: number;
    perPage: number;
    total: number;
};

export type LearningSearchResponse = {
    pagination: LearningSearchPagination;
    results: LearningSearchResult[];
};
