// @ts-nocheck
import React, { forwardRef } from 'react';

import { useContainerGridContext } from './ContainerGrid.context';
import useStyles from './ContainerCol.styles';
import type { ColSpan, DefaultProps } from '@mantine/core';
import { Box, useComponentDefaultProps } from '@mantine/core';

export interface ColProps extends DefaultProps, React.ComponentPropsWithoutRef<'div'> {
  /** Default col span */
  span?: ColSpan;

  /** Column left offset */
  offset?: number;

  /** Default col order */
  order?: React.CSSProperties['order'];

  /** Col order at (min-width: theme.breakpoints.xs) */
  orderXs?: React.CSSProperties['order'];

  /** Col order at (min-width: theme.breakpoints.sm) */
  orderSm?: React.CSSProperties['order'];

  /** Col order at (min-width: theme.breakpoints.md) */
  orderMd?: React.CSSProperties['order'];

  /** Col order at (min-width: theme.breakpoints.lg) */
  orderLg?: React.CSSProperties['order'];

  /** Col order at (min-width: theme.breakpoints.xl) */
  orderXl?: React.CSSProperties['order'];

  /** Column left offset at (min-width: theme.breakpoints.xs) */
  offsetXs?: number;

  /** Column left offset at (min-width: theme.breakpoints.sm) */
  offsetSm?: number;

  /** Column left offset at (min-width: theme.breakpoints.md) */
  offsetMd?: number;

  /** Column left offset at (min-width: theme.breakpoints.lg) */
  offsetLg?: number;

  /** Column left offset at (min-width: theme.breakpoints.xl) */
  offsetXl?: number;

  /** Col span at (min-width: theme.breakpoints.xs) */
  xs?: ColSpan;

  /** Col span at (min-width: theme.breakpoints.sm) */
  sm?: ColSpan;

  /** Col span at (min-width: theme.breakpoints.md) */
  md?: ColSpan;

  /** Col span at (min-width: theme.breakpoints.lg) */
  lg?: ColSpan;

  /** Col span at (min-width: theme.breakpoints.xl) */
  xl?: ColSpan;
}

const defaultProps: Partial<ColProps> = {};

function isValidSpan(span: ColSpan) {
  if (span === 'auto' || span === 'content') {
    return true;
  }
  return typeof span === 'number' && span > 0 && span % 1 === 0;
}

export const ContainerCol = forwardRef<HTMLDivElement, ColProps>((props: ColProps, ref) => {
  const {
    children,
    span,
    offset,
    offsetXs,
    offsetSm,
    offsetMd,
    offsetLg,
    offsetXl,
    xs,
    sm,
    md,
    lg,
    xl,
    order,
    orderXs,
    orderSm,
    orderMd,
    orderLg,
    orderXl,
    className,
    id,
    unstyled,
    ...others
  } = useComponentDefaultProps('GridCol', defaultProps, props);

  const ctx = useContainerGridContext();

  const colSpan = span || ctx.columns;
  const { classes, cx } = useStyles(
    {
      gutter: ctx.gutter,
      gutterXs: ctx.gutterXs,
      gutterSm: ctx.gutterSm,
      gutterMd: ctx.gutterMd,
      gutterLg: ctx.gutterLg,
      gutterXl: ctx.gutterXl,
      offset,
      offsetXs,
      offsetSm,
      offsetMd,
      offsetLg,
      offsetXl,
      xs,
      sm,
      md,
      lg,
      xl,
      order,
      orderXs,
      orderSm,
      orderMd,
      orderLg,
      orderXl,
      grow: ctx.grow,
      columns: ctx.columns,
      span: colSpan,
      containerName: ctx.containerName,
    },
    { unstyled, name: 'ContainerGrid' }
  );

  if (!isValidSpan(colSpan) || (typeof colSpan === 'number' && colSpan > ctx.columns)) {
    return null;
  }

  return (
    <Box className={cx(classes.col, className)} ref={ref} {...others}>
      {children}
    </Box>
  );
});

ContainerCol.displayName = 'ContainerCol';
