import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import BleedingCardCarousel from '../src/components/BleedingCardCarousel.vue'

describe('BleedingCardCarousel', () => {
  it('renders slot content inside bleeding container', () => {
    const wrapper = mount(BleedingCardCarousel, {
      slots: {
        default: () => [
          h('div', { class: 'card-1' }, 'Card 1'),
          h('div', { class: 'card-2' }, 'Card 2'),
        ],
      },
    })

    expect(wrapper.find('.bleeding-edge-carousel').exists()).toBe(true)
    expect(wrapper.find('.bleeding-edge-container').exists()).toBe(true)
    expect(wrapper.find('.card-1').text()).toBe('Card 1')
    expect(wrapper.find('.card-2').text()).toBe('Card 2')
  })

  it('applies edge fade mask by default', () => {
    const wrapper = mount(BleedingCardCarousel)
    expect(wrapper.find('.edge-fade-mask').exists()).toBe(true)
  })

  it('can toggle off fade mask via prop', () => {
    const wrapper = mount(BleedingCardCarousel, {
      props: {
        fadeMask: false,
      },
    })
    expect(wrapper.find('.edge-fade-mask').exists()).toBe(false)
  })
})
