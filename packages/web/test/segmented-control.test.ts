import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SegmentedControl from '../src/components/SegmentedControl.vue'

describe('SegmentedControl component', () => {
  const options = [
    { label: 'Active', value: 'active', badge: 12 },
    { label: 'Archived', value: 'archived', badge: 3 },
  ]

  it('renders all options and labels', () => {
    const wrapper = mount(SegmentedControl, {
      props: {
        modelValue: 'active',
        options,
      },
    })

    expect(wrapper.text()).toContain('Active')
    expect(wrapper.text()).toContain('Archived')
    expect(wrapper.text()).toContain('12')
    expect(wrapper.text()).toContain('3')
  })

  it('indicates the active option correctly', () => {
    const wrapper = mount(SegmentedControl, {
      props: {
        modelValue: 'active',
        options,
      },
    })

    const buttons = wrapper.findAll('.segmented-control__btn')
    expect(buttons[0].classes()).toContain('segmented-control__btn--active')
    expect(buttons[1].classes()).not.toContain('segmented-control__btn--active')
  })

  it('emits update:modelValue when an option is clicked', async () => {
    const wrapper = mount(SegmentedControl, {
      props: {
        modelValue: 'active',
        options,
      },
    })

    const buttons = wrapper.findAll('.segmented-control__btn')
    await buttons[1].trigger('click')

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['archived'])
  })
})
