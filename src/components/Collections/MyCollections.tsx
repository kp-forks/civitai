import {
  NavLink,
  ScrollArea,
  Stack,
  TextInput,
  Skeleton,
  Text,
  ThemeIcon,
  Group,
  Divider,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { CollectionContributorPermission } from '~/shared/utils/prisma/enums';
import { IconPlaylistX, IconSearch } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { useCurrentUser } from '~/hooks/useCurrentUser';
import type { CollectionGetAllUserModel } from '~/types/router';
import { trpc } from '~/utils/trpc';
import { useRouter } from 'next/router';

export function MyCollections({ children, onSelect, sortOrder = 'asc' }: MyCollectionsProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery] = useDebouncedValue(query, 300);
  const currentUser = useCurrentUser();
  const router = useRouter();
  const { data: collections = [], isLoading } = trpc.collection.getAllUser.useQuery(
    { permission: CollectionContributorPermission.VIEW },
    { enabled: !!currentUser }
  );

  const selectCollection = (id: number) => {
    router.push(`/collections/${id}`);
    onSelect?.(collections.find((c) => c.id === id)!);
  };

  const filteredCollections = useMemo(
    () =>
      !debouncedQuery
        ? collections
        : collections.filter((c) => c.name.toLowerCase().includes(debouncedQuery.toLowerCase())),
    [debouncedQuery, collections]
  );

  const sortedCollections = useMemo(() => {
    if (!filteredCollections) return [];

    return [...filteredCollections].sort((a, b) =>
      sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
    );
  }, [filteredCollections, sortOrder]);

  const noCollections = !isLoading && sortedCollections.length === 0;
  const ownedFilteredCollections = sortedCollections.filter((collection) => collection.isOwner);
  const contributingFilteredCollections = sortedCollections.filter(
    (collection) => !collection.isOwner
  );

  const FilterBox = (
    <TextInput
      variant="unstyled"
      leftSection={<IconSearch size={20} />}
      onChange={(e) => setQuery(e.target.value)}
      value={query}
      placeholder="Filter"
    />
  );

  const Collections = (
    <Skeleton visible={isLoading} animate>
      {ownedFilteredCollections.map((c) => (
        <NavLink
          key={c.id}
          radius="sm"
          onClick={() => selectCollection(c.id)}
          active={router.query?.collectionId === c.id.toString()}
          label={<Text>{c.name}</Text>}
        />
      ))}
      {contributingFilteredCollections.length > 0 && <Divider label="Following" mt="sm" ml="sm" />}
      {contributingFilteredCollections.map((c) => (
        <NavLink
          key={c.id}
          radius="sm"
          onClick={() => selectCollection(c.id)}
          active={router.query?.collectionId === c.id.toString()}
          label={<Text>{c.name}</Text>}
        />
      ))}
      {noCollections && (
        <Group>
          <ThemeIcon color="gray" size="md" radius="xl">
            <IconPlaylistX size={20} />
          </ThemeIcon>
          <Text c="dimmed">No collections found</Text>
        </Group>
      )}
    </Skeleton>
  );

  if (children) {
    return children({
      FilterBox,
      Collections,
      collections: sortedCollections,
      isLoading,
      noCollections,
    });
  }

  return (
    <Stack gap={4}>
      {FilterBox}
      <ScrollArea>{Collections}</ScrollArea>
    </Stack>
  );
}

type SortOrder = 'asc' | 'desc';

type MyCollectionsProps = {
  children?: (elements: {
    FilterBox: React.ReactNode;
    Collections: React.ReactNode;
    collections: CollectionGetAllUserModel[];
    isLoading: boolean;
    noCollections: boolean;
  }) => JSX.Element;
  onSelect?: (collection: CollectionGetAllUserModel) => void;
  pathnameOverride?: string;
  sortOrder?: SortOrder; // <-- ADDED THIS
};
