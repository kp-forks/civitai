import {
  Tooltip,
  ActionIcon,
  CloseButton,
  SegmentedControl,
  Text,
  useMantineTheme,
} from '@mantine/core';
import { IconArrowsDiagonal, IconBrush, IconGridDots, TablerIconsProps } from '@tabler/icons-react';
import { Feed } from './Feed';
import { Queue } from './Queue';
import { GenerationPanelView, generationPanel, useGenerationStore } from '~/store/generation.store';
import { useCurrentUser } from '~/hooks/useCurrentUser';
import React, { useEffect } from 'react';
import { GenerationForm } from '~/components/ImageGeneration/GenerationForm/GenerationForm';
import { useRouter } from 'next/router';
import { IconClockHour9 } from '@tabler/icons-react';
import { GeneratedImageActions } from '~/components/ImageGeneration/GeneratedImageActions';
import { GenerationProvider } from '~/components/ImageGeneration/GenerationProvider';
import { useMediaQuery } from '@mantine/hooks';

export default function GenerationTabs({
  tabs: tabsToInclude,
  alwaysShowMaximize = true,
  isDrawer,
}: {
  tabs?: ('generate' | 'queue' | 'feed')[];
  alwaysShowMaximize?: boolean;
  isDrawer?: boolean;
}) {
  const router = useRouter();
  const currentUser = useCurrentUser();

  const isGeneratePage = router.pathname.startsWith('/generate');
  const isImageFeedSeparate = isGeneratePage && !isDrawer;

  const view = useGenerationStore((state) => state.view);
  const setView = useGenerationStore((state) => state.setView);

  const View = isImageFeedSeparate ? tabs.generate.Component : tabs[view].Component;
  const tabEntries = Object.entries(tabs).filter(([key]) =>
    isImageFeedSeparate ? key !== 'generate' : true
  );

  useEffect(() => {
    if (isImageFeedSeparate && view === 'generate') {
      setView('queue');
    }
  }, [isImageFeedSeparate, view]);

  return (
    <GenerationProvider>
      <div className="flex flex-col gap-2 p-3 w-full">
        <div className="flex justify-between items-center gap-2 w-full">
          <div className="flex-1">
            {/* <Text className="w-full" lineClamp={1}>
              Folder
            </Text> */}
          </div>
          {currentUser && tabEntries.length > 1 && (
            <SegmentedControl
              // TODO.briant: this fixes the issue with rendering the SegmentedControl
              key={tabEntries.map(([, item]) => item.label).join('-')}
              className="flex-shrink-0"
              sx={{ overflow: 'visible' }}
              data={tabEntries.map(([key, { Icon, label }]) => ({
                label: (
                  <Tooltip label={label} position="bottom" color="dark" openDelay={200} offset={10}>
                    <Icon size={16} />
                  </Tooltip>
                ),
                value: key,
              }))}
              onChange={(key) => setView(key as any)}
              value={view}
            />
          )}
          <div className="flex flex-1 justify-end">
            {alwaysShowMaximize && !isGeneratePage && (
              <Tooltip label="Maximize">
                <ActionIcon
                  size="lg"
                  onClick={() => router.push('/generate')}
                  variant="transparent"
                >
                  <IconArrowsDiagonal size={20} />
                </ActionIcon>
              </Tooltip>
            )}
            <CloseButton
              onClick={isGeneratePage ? () => history.go(-1) : generationPanel.close}
              size="lg"
              variant="transparent"
            />
          </div>
        </div>
        {view !== 'generate' && <GeneratedImageActions />}
      </div>
      <View />
    </GenerationProvider>
  );
}

type Tabs = Record<
  GenerationPanelView,
  {
    Icon: (props: TablerIconsProps) => JSX.Element;
    label: string;
    Component: React.FC;
  }
>;

const tabs: Tabs = {
  generate: {
    Icon: IconBrush,
    label: 'Generate',
    Component: GenerationForm,
  },
  queue: {
    Icon: IconClockHour9,
    label: 'Queue',
    Component: Queue,
  },
  feed: {
    Icon: IconGridDots,
    label: 'Feed',
    Component: Feed,
  },
};
