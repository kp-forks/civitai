import { Group, Text, Stack, Popover, ActionIcon, Checkbox } from '@mantine/core';
import { IconEyeExclamation, TablerIconsProps } from '@tabler/icons-react';
import { useBrowsingModeContext } from '~/components/BrowsingLevel/BrowsingLevelProvider';
import { BrowsingLevelsGrouped } from '~/components/BrowsingLevel/BrowsingLevelsGrouped';
import { openHiddenTagsModal } from '~/components/Dialog/dialog-registry';
import { useCurrentUser } from '~/hooks/useCurrentUser';
import { constants } from '~/server/common/constants';

export function BrowsingModeIcon({ iconProps = {} }: BrowsingModeIconProps) {
  const currentUser = useCurrentUser();
  if (!currentUser) return null;
  return (
    <Popover zIndex={constants.imageGeneration.drawerZIndex + 1} withArrow withinPortal>
      <Popover.Target>
        <ActionIcon>
          <IconEyeExclamation {...iconProps} />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown p="md">
        <BrowsingModeMenu />
      </Popover.Dropdown>
    </Popover>
  );
}
type BrowsingModeIconProps = {
  iconProps?: TablerIconsProps;
};

export function BrowsingModeMenu() {
  const { toggleBlurNsfw, toggleDisableHidden, useStore } = useBrowsingModeContext();
  const { blurNsfw } = useStore((state) => state);
  const currentUser = useCurrentUser();
  const showNsfw = currentUser?.showNsfw;
  // const blurNsfw = currentUser?.blurNsfw;
  const disableHidden = currentUser?.disableHidden;

  return (
    <div id="browsing-mode">
      <Stack spacing="md" className="sm:min-w-96">
        {showNsfw && (
          <Stack spacing="lg">
            <Stack spacing={4}>
              <Text>Browsing Level</Text>
              <BrowsingLevelsGrouped />
            </Stack>
            <Checkbox
              checked={blurNsfw}
              onChange={(e) => toggleBlurNsfw(e.target.checked)}
              label="Blur mature content (R+)"
              size="md"
            />
          </Stack>
        )}

        <Group position="apart">
          <Checkbox
            checked={!disableHidden}
            onChange={(e) => toggleDisableHidden(!e.target.checked)}
            label="Apply hidden tags filter"
            size="md"
          />
          <Text
            variant="link"
            className="hover:cursor-pointer"
            underline
            onClick={openHiddenTagsModal}
          >
            My filters
          </Text>
        </Group>
      </Stack>
    </div>
  );
}
