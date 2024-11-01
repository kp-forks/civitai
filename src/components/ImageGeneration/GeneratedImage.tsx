import { Carousel, Embla, useAnimationOffsetEffect } from '@mantine/carousel';
import { ActionIcon, Checkbox, createStyles, Group, Menu, Modal } from '@mantine/core';
import { IntersectionObserverProvider } from '~/components/IntersectionObserver/IntersectionObserverProvider';
import { useClipboard, useHotkeys } from '@mantine/hooks';
import { openConfirmModal } from '@mantine/modals';
import {
  IconArrowsShuffle,
  IconCheck,
  IconDotsVertical,
  IconExternalLink,
  IconInfoCircle,
  IconInfoHexagon,
  IconPlayerTrackNextFilled,
  IconThumbDown,
  IconThumbUp,
  IconTrash,
  IconWand,
  IconHeart,
} from '@tabler/icons-react';
import clsx from 'clsx';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useDialogContext } from '~/components/Dialog/DialogProvider';
import { dialogStore, useDialogStore } from '~/components/Dialog/dialogStore';
// import { GeneratedImageLightbox } from '~/components/ImageGeneration/GeneratedImageLightbox';
import { GenerationDetails } from '~/components/ImageGeneration/GenerationDetails';
import { orchestratorImageSelect } from '~/components/ImageGeneration/utils/generationImage.select';
import {
  useGetTextToImageRequestsImages,
  useUpdateImageStepMetadata,
} from '~/components/ImageGeneration/utils/generationRequestHooks';
import { ImageMetaPopover } from '~/components/ImageMeta/ImageMeta';
import { useInViewDynamic } from '~/components/IntersectionObserver/IntersectionObserverProvider';
import { TextToImageQualityFeedbackModal } from '~/components/Modals/GenerationQualityFeedbackModal';
import { UpscaleImageModal } from '~/components/Orchestrator/components/UpscaleImageModal';
import { TwCard } from '~/components/TwCard/TwCard';
import { constants } from '~/server/common/constants';
import { TextToImageParams } from '~/server/schema/orchestrator/textToImage.schema';
import {
  NormalizedGeneratedImage,
  NormalizedGeneratedImageResponse,
  NormalizedGeneratedImageStep,
} from '~/server/services/orchestrator';
import { getIsFlux, getIsSD3 } from '~/shared/constants/generation.constants';
import { generationStore, useGenerationStore } from '~/store/generation.store';
import { trpc } from '~/utils/trpc';
import { EdgeMedia2 } from '~/components/EdgeMedia/EdgeMedia';
import { MediaType } from '@prisma/client';

export type GeneratedImageProps = {
  image: NormalizedGeneratedImage;
  request: NormalizedGeneratedImageResponse;
  step: NormalizedGeneratedImageStep;
};

export function GeneratedImage({
  image,
  request,
  step,
}: {
  image: NormalizedGeneratedImage;
  request: NormalizedGeneratedImageResponse;
  step: NormalizedGeneratedImageStep;
}) {
  const { classes } = useStyles();
  const [ref, inView] = useInViewDynamic({ id: image.id });
  // const { ref, inView, sizeMapping } = useIntersectionObserverContext({ id: image.id });
  // const { ref, inView } = useInView({ rootMargin: '600px' });
  const selected = orchestratorImageSelect.useIsSelected({
    workflowId: request.id,
    stepName: step.name,
    imageId: image.id,
  });
  const { pathname } = useRouter();
  const view = useGenerationStore((state) => state.view);

  const { updateImages, isLoading } = useUpdateImageStepMetadata();
  const { data: workflowDefinitions } = trpc.generation.getWorkflowDefinitions.useQuery();
  const img2imgWorkflows = workflowDefinitions?.filter((x) => x.type === 'img2img');

  // if (request.id.indexOf('-') !== request.id.lastIndexOf('-')) {
  //   console.log({ workflowId: request.id, stepName: step.name, imageId: image.id, selected });
  // }

  const toggleSelect = (checked?: boolean) =>
    orchestratorImageSelect.toggle(
      {
        workflowId: request.id,
        stepName: step.name,
        imageId: image.id,
      },
      checked
    );
  const { copied, copy } = useClipboard();

  const canClickImage = useDialogStore(
    (state) => !state.dialogs.some((x) => x.id === 'generated-image')
  );
  const handleImageClick = () => {
    if (!image || !available || !canClickImage) return;

    dialogStore.trigger({
      id: 'generated-image',
      component: GeneratedImageLightbox,
      props: { image, request },
    });
  };
  function handleCloseImageLightbox() {
    dialogStore.closeById('generated-image');
  }

  const handleAuxClick = () => {
    if (image) window.open(image.url, '_blank');
  };

  const handleGenerate = ({ seed, ...rest }: Partial<TextToImageParams> = {}, type?: MediaType) => {
    handleCloseImageLightbox();
    generationStore.setData({
      resources: step.resources,
      params: { ...step.params, seed, ...rest },
      remixOfId: step.metadata?.remixOfId,
      view: !pathname.includes('/generate') ? 'generate' : view,
      type: type ?? image.type, // TODO - type based off type of media
    });
  };

  const handleSelectWorkflow = (workflow: string) => handleGenerate({ workflow, image: image.url });

  const handleDeleteImage = () => {
    openConfirmModal({
      title: 'Delete image',
      children:
        'Are you sure that you want to delete this image? This is a destructive action and cannot be undone.',
      labels: { cancel: 'Cancel', confirm: 'Yes, delete it' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        updateImages([
          {
            workflowId: request.id,
            stepName: step.name,
            images: {
              [image.id]: {
                hidden: true,
              },
            },
          },
        ]);
        handleCloseImageLightbox();
      },
      zIndex: constants.imageGeneration.drawerZIndex + 2,
      centered: true,
    });
  };

  const handleUpscale = (workflow: string) => {
    handleCloseImageLightbox();
    if (step.$type !== 'videoGen')
      dialogStore.trigger({
        component: UpscaleImageModal,
        props: {
          resources: step.resources,
          params: {
            ...step.params,
            image: image.url,
            seed: image.seed,
            workflow,
          },
        },
      });
  };

  const feedback = step.metadata?.images?.[image.id]?.feedback;
  const isFavorite = step.metadata?.images?.[image.id]?.favorite === true;
  const available = image.status === 'succeeded';

  const [buttonState, setButtonState] = useState({
    favorite: isFavorite,
    feedback,
  });

  function handleToggleFeedback(newFeedback: 'liked' | 'disliked') {
    setButtonState({
      ...buttonState,
      feedback: feedback === newFeedback ? undefined : newFeedback,
    });

    function onError() {
      setButtonState({ ...buttonState, feedback });
    }

    if (feedback !== 'disliked' && newFeedback === 'disliked') {
      dialogStore.trigger({
        component: TextToImageQualityFeedbackModal,
        props: {
          workflowId: request.id,
          imageId: image.id,
          comments: step.metadata?.images?.[image.id]?.comments,
          stepName: step.name,
        },
      });
    }

    updateImages(
      [
        {
          workflowId: request.id,
          stepName: step.name,
          images: {
            [image.id]: {
              feedback: newFeedback,
            },
          },
        },
      ],
      onError
    );
  }

  function handleToggleFavorite(newValue: true | false) {
    setButtonState({ ...buttonState, favorite: newValue });

    function onError() {
      setButtonState({ ...buttonState, favorite: isFavorite });
    }

    updateImages(
      [
        {
          workflowId: request.id,
          stepName: step.name,
          images: {
            [image.id]: {
              favorite: newValue,
            },
          },
        },
      ],
      onError
    );
  }

  if (!available) return <></>;

  const isUpscale = step.params.workflow === 'img2img-upscale';
  const isVideo = step.$type === 'videoGen';
  const isFlux = !isVideo && getIsFlux(step.params.baseModel);
  const isSD3 = !isVideo && getIsSD3(step.params.baseModel);
  const canRemix = !isUpscale;
  const canImg2Img = !isFlux && !isUpscale && !isSD3 && !isVideo;
  // const canRemix = true;
  // const canImg2Img = true;

  return (
    <TwCard ref={ref} className={classes.imageWrapper} style={{ aspectRatio: image.aspectRatio }}>
      {inView && (
        <>
          <div
            className={clsx('relative flex flex-1 flex-col items-center justify-center', {
              ['cursor-pointer']: canClickImage,
            })}
            onClick={handleImageClick}
            onMouseDown={(e) => {
              if (e.button === 1) return handleAuxClick();
            }}
          >
            <EdgeMedia2
              src={image.url}
              type={image.type}
              alt=""
              wrapperProps={{ style: { height: '100%' } }}
              // onDragStart={(e) => {
              //   if (image.url) e.dataTransfer.setData('text/uri-list', image.url);
              // }}
            />
            <div className="pointer-events-none absolute size-full rounded-md shadow-[inset_0_0_2px_1px_rgba(255,255,255,0.2)]" />
          </div>
          {canClickImage && (
            <label className="absolute left-3 top-3 ">
              <Checkbox
                className={classes.checkbox}
                checked={selected}
                onChange={(e) => {
                  toggleSelect(e.target.checked);
                }}
              />
            </label>
          )}
          <Menu zIndex={400} withinPortal>
            <Menu.Target>
              <div className="absolute right-3 top-3">
                <ActionIcon variant="transparent">
                  <IconDotsVertical
                    size={26}
                    color="#fff"
                    filter="drop-shadow(1px 1px 2px rgb(0 0 0 / 50%)) drop-shadow(0px 5px 15px rgb(0 0 0 / 60%))"
                  />
                </ActionIcon>
              </div>
            </Menu.Target>
            <Menu.Dropdown>
              {canRemix && (
                <>
                  <Menu.Item
                    onClick={() => handleGenerate()}
                    icon={<IconArrowsShuffle size={14} stroke={1.5} />}
                  >
                    Remix
                  </Menu.Item>
                  <Menu.Item
                    onClick={() => handleGenerate({ seed: image.seed })}
                    icon={<IconPlayerTrackNextFilled size={14} stroke={1.5} />}
                  >
                    Remix (with seed)
                  </Menu.Item>
                </>
              )}
              <Menu.Item
                color="red"
                onClick={handleDeleteImage}
                icon={<IconTrash size={14} stroke={1.5} />}
              >
                Delete
              </Menu.Item>
              {!!img2imgWorkflows?.length && canImg2Img && (
                <>
                  <Menu.Divider />
                  <Menu.Label>Image-to-image workflows</Menu.Label>
                  {img2imgWorkflows?.map((workflow) => (
                    <Menu.Item
                      key={workflow.key}
                      onClick={() => {
                        if (workflow.key === 'img2img-upscale') handleUpscale(workflow.key);
                        else handleSelectWorkflow(workflow.key);
                      }}
                    >
                      {workflow.name}
                    </Menu.Item>
                  ))}
                </>
              )}
              {!isVideo && (
                <Menu.Item
                  onClick={() => handleGenerate({ sourceImageUrl: image.url } as any, 'video')}
                >
                  Image to Video
                </Menu.Item>
              )}
              <Menu.Divider />
              <Menu.Label>System</Menu.Label>
              <Menu.Item
                icon={
                  copied ? (
                    <IconCheck size={14} stroke={1.5} />
                  ) : (
                    <IconInfoHexagon size={14} stroke={1.5} />
                  )
                }
                onClick={() => copy(image.jobId)}
              >
                Copy Job ID
              </Menu.Item>
              <Menu.Item
                icon={<IconExternalLink size={14} stroke={1.5} />}
                onClick={handleAuxClick}
              >
                Open in New Tab
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>

          <Group spacing={4} className={clsx(classes.actionsWrapper, 'absolute bottom-2 left-2')}>
            <ActionIcon
              size="md"
              className={buttonState.favorite ? classes.favoriteButton : undefined}
              variant={buttonState.favorite ? 'light' : undefined}
              color={buttonState.favorite ? 'red' : undefined}
              onClick={() => handleToggleFavorite(!buttonState.favorite)}
            >
              <IconHeart size={16} />
            </ActionIcon>

            {!!img2imgWorkflows?.length && canImg2Img && (
              <Menu
                zIndex={400}
                trigger="hover"
                openDelay={100}
                closeDelay={100}
                transition="fade"
                transitionDuration={150}
                withinPortal
                position="top"
              >
                <Menu.Target>
                  <ActionIcon size="md">
                    <IconWand size={16} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown className={classes.improveMenu}>
                  {img2imgWorkflows?.map((workflow) => (
                    <Menu.Item
                      key={workflow.key}
                      onClick={() => {
                        if (workflow.key === 'img2img-upscale') handleUpscale(workflow.key);
                        else handleSelectWorkflow(workflow.key);
                      }}
                    >
                      {workflow.name}
                    </Menu.Item>
                  ))}
                </Menu.Dropdown>
              </Menu>
            )}

            <ActionIcon
              size="md"
              variant={buttonState.feedback === 'liked' ? 'light' : undefined}
              color={buttonState.feedback === 'liked' ? 'green' : undefined}
              onClick={() => handleToggleFeedback('liked')}
            >
              <IconThumbUp size={16} />
            </ActionIcon>

            <ActionIcon
              size="md"
              variant={buttonState.feedback === 'disliked' ? 'light' : undefined}
              color={buttonState.feedback === 'disliked' ? 'red' : undefined}
              onClick={() => handleToggleFeedback('disliked')}
            >
              <IconThumbDown size={16} />
            </ActionIcon>
          </Group>
          <div className="absolute bottom-2 right-2">
            <ImageMetaPopover
              meta={step.params}
              zIndex={constants.imageGeneration.drawerZIndex + 1}
              hideSoftware
            >
              <ActionIcon variant="transparent" size="md">
                <IconInfoCircle
                  color="white"
                  filter="drop-shadow(1px 1px 2px rgb(0 0 0 / 50%)) drop-shadow(0px 5px 15px rgb(0 0 0 / 60%))"
                  opacity={0.8}
                  strokeWidth={2.5}
                  size={26}
                />
              </ActionIcon>
            </ImageMetaPopover>
          </div>
        </>
      )}
    </TwCard>
  );
}

const useStyles = createStyles((theme, _params, getRef) => {
  const thumbActionRef = getRef('thumbAction');
  const favoriteButtonRef = getRef('favoriteButton');

  const buttonBackground = {
    boxShadow: '0 -2px 6px 1px rgba(0,0,0,0.16)',
    background: theme.fn.rgba(
      theme.colorScheme === 'dark' ? theme.colors.dark[6] : theme.colors.gray[0],
      0.6
    ),
  };

  return {
    checkbox: {
      '& input:checked': {
        borderColor: theme.white,
      },
    },
    imageWrapper: {
      background: theme.colorScheme === 'dark' ? theme.colors.dark[5] : theme.colors.gray[2],
      [`&:hover .${thumbActionRef}`]: buttonBackground,
      [`&:hover .${thumbActionRef} button`]: {
        opacity: 1,
        transition: 'opacity .3s',
      },
    },
    actionsWrapper: {
      ref: thumbActionRef,
      borderRadius: theme.radius.sm,
      padding: 4,
      transition: 'opacity .3s',

      [`@container (max-width: 420px)`]: {
        ...buttonBackground,
        width: 68,
      },

      ['button']: {
        opacity: 0,

        [`&.${favoriteButtonRef}`]: {
          opacity: 1,
        },

        [`@container (max-width: 420px)`]: {
          opacity: 1,
        },
      },
    },
    favoriteButton: {
      ref: favoriteButtonRef,
      background: 'rgba(240, 62, 62, 0.5)',
    },

    improveMenu: {
      borderRadius: theme.radius.sm,
      background: theme.fn.rgba(
        theme.colorScheme === 'dark' ? theme.colors.dark[6] : theme.colors.gray[0],
        0.8
      ),
      border: 'none',
      boxShadow: '0 -2px 6px 1px rgba(0,0,0,0.16)',
      padding: 4,
    },
  };
});

const TRANSITION_DURATION = 200;

export function GeneratedImageLightbox({
  image,
  request,
}: {
  image: NormalizedGeneratedImage;
  request: NormalizedGeneratedImageResponse;
}) {
  const dialog = useDialogContext();
  const { steps } = useGetTextToImageRequestsImages();

  const [embla, setEmbla] = useState<Embla | null>(null);
  useAnimationOffsetEffect(embla, TRANSITION_DURATION);

  useHotkeys([
    ['ArrowLeft', () => embla?.scrollPrev()],
    ['ArrowRight', () => embla?.scrollNext()],
  ]);

  const images = steps.flatMap((step) =>
    step.images
      .filter((x) => x.status === 'succeeded')
      .map((image) => ({ ...image, params: { ...step.params, seed: image.seed } }))
  );

  const [slide, setSlide] = useState(() => {
    const initialSlide = images.findIndex((item) => item.id === image.id);
    return initialSlide > -1 ? initialSlide : 0;
  });

  return (
    <Modal {...dialog} closeButtonLabel="Close lightbox" fullScreen>
      <IntersectionObserverProvider id="generated-image-lightbox">
        <Carousel
          align="center"
          slideGap="md"
          slidesToScroll={1}
          controlSize={40}
          initialSlide={slide}
          getEmblaApi={setEmbla}
          withKeyboardEvents={false}
          onSlideChange={setSlide}
          loop
        >
          {steps.flatMap((step) =>
            step.images
              .filter((x) => x.status === 'succeeded')
              .map((image) => (
                <Carousel.Slide
                  key={`${image.workflowId}_${image.id}`}
                  style={{
                    height: 'calc(100vh - 84px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {image.url && (
                    <GeneratedImage
                      image={{ ...image, params: { ...step.params, seed: image.seed } } as any} // TODO - fix this
                      request={request}
                      step={step}
                    />
                  )}
                </Carousel.Slide>
              ))
          )}
          {/* {images.map((item) => (
          <Carousel.Slide
            key={`${item.workflowId}_${item.id}`}
            style={{
              height: 'calc(100vh - 84px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {item.url && <GeneratedImage image={image} request={request} step={step} />}
          </Carousel.Slide>
        ))} */}
        </Carousel>
      </IntersectionObserverProvider>
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          right: 0,
          width: '100%',
          maxWidth: 450,
          zIndex: 10,
        }}
      >
        <GenerationDetails
          label="Generation Details"
          params={images?.[slide]?.params}
          labelWidth={150}
          paperProps={{ radius: 0 }}
          controlProps={{
            sx: (theme) => ({
              backgroundColor:
                theme.colorScheme === 'dark' ? theme.colors.dark[5] : theme.colors.gray[2],
            }),
          }}
          upsideDown
        />
      </div>
    </Modal>
  );
}
