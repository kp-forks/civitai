import type { DefaultMantineColor } from '@mantine/core';
import { Box, Loader, RingProgress } from '@mantine/core';
import { useHover } from '@mantine/hooks';
import { IconCheck, IconScreenShare, IconTrash, IconX } from '@tabler/icons-react';
import type { CivitaiLinkResourceManagerProps } from '~/components/CivitaiLink/CivitaiLinkResourceManager';
import { CivitaiLinkResourceManager } from '~/components/CivitaiLink/CivitaiLinkResourceManager';
import type { CivitaiTooltipProps } from '~/components/CivitaiWrapped/CivitaiTooltip';
import { CivitaiTooltip } from '~/components/CivitaiWrapped/CivitaiTooltip';
import { useContainerSmallerThan } from '~/components/ContainerProvider/useContainerSmallerThan';

const buttonStates: Record<string, ButtonStateFn> = {
  downloading: ({ hovered, progress, iconSize }) => ({
    // icon: hovered ? <IconX strokeWidth={2.5} /> : <Loader color="#fff" size={24} />,
    icon: hovered ? (
      <IconX strokeWidth={2.5} size={iconSize} />
    ) : progress ? (
      <RingProgress
        size={iconSize ?? 30}
        thickness={4}
        rootColor="rgba(255, 255, 255, 0.4)"
        sections={[{ value: progress ?? 0, color: 'rgba(255, 255, 255, 0.8)' }]}
      />
    ) : (
      <Loader color="#fff" size={iconSize ?? 24} />
    ),
    color: hovered ? 'red' : 'blue',
    label: hovered ? 'Cancel download' : 'Downloading',
  }),
  installed: ({ hovered, iconSize }) => ({
    icon: hovered ? <IconTrash size={iconSize} /> : <IconCheck size={iconSize} strokeWidth={2.5} />,
    color: hovered ? 'red' : 'green',
    label: hovered ? 'Remove from Link' : 'Installed',
  }),
  notInstalled: ({ iconSize }) => ({
    icon: <IconScreenShare strokeWidth={2.5} size={iconSize} />,
    color: 'blue',
    label: 'Send via Link',
  }),
};

type ButtonStateFn = (props: { hovered?: boolean; progress?: number; iconSize?: number }) => {
  icon: JSX.Element;
  color: DefaultMantineColor;
  label: string;
};

export const CivitaiLinkManageButton = ({
  children,
  noTooltip,
  tooltipProps = {},
  iconSize,
  ...managerProps
}: {
  iconSize?: number;
  children: (props: ChildFuncProps) => JSX.Element;
  noTooltip?: boolean;
  tooltipProps?: Omit<CivitaiTooltipProps, 'children' | 'label'>;
} & CivitaiLinkResourceManagerProps) => {
  const { hovered, ref } = useHover();
  const isMobile = useContainerSmallerThan('sm');

  return (
    <CivitaiLinkResourceManager {...managerProps}>
      {({ addResource, removeResource, cancelDownload, downloading, hasResource, progress }) => {
        const state = downloading ? 'downloading' : hasResource ? 'installed' : 'notInstalled';
        const buttonState = buttonStates[state]({
          hovered: !isMobile && hovered,
          progress,
          iconSize,
        });
        const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
          e.preventDefault();
          e.stopPropagation();

          if (downloading) cancelDownload();
          else if (hasResource) removeResource();
          else addResource();
        };

        if (noTooltip) return children({ ref, onClick, ...buttonState });

        return (
          <CivitaiTooltip label={buttonState.label} {...tooltipProps}>
            <Box w="100%">{children({ ref, onClick, ...buttonState })}</Box>
          </CivitaiTooltip>
        );
      }}
    </CivitaiLinkResourceManager>
  );
};

type ChildFuncProps = {
  ref: React.RefObject<HTMLButtonElement>;
  color: DefaultMantineColor;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  icon: React.ReactNode;
  label: string;
};
