import { render, screen, fireEvent } from '@testing-library/react'
import PinInput from '@/components/PinInput'

describe('PinInput', () => {
  it('renders 4 dot indicators', () => {
    render(<PinInput onComplete={jest.fn()} />)
    expect(screen.getAllByTestId('pin-dot')).toHaveLength(4)
  })

  it('fills dots as digits are entered', () => {
    render(<PinInput onComplete={jest.fn()} />)
    fireEvent.click(screen.getByText('1'))
    fireEvent.click(screen.getByText('2'))
    const dots = screen.getAllByTestId('pin-dot')
    expect(dots[0]).toHaveClass('bg-blue-500')
    expect(dots[1]).toHaveClass('bg-blue-500')
    expect(dots[2]).not.toHaveClass('bg-blue-500')
  })

  it('calls onComplete with 4-digit string when full', () => {
    const onComplete = jest.fn()
    render(<PinInput onComplete={onComplete} />)
    ;['1','2','3','4'].forEach(d => fireEvent.click(screen.getByText(d)))
    expect(onComplete).toHaveBeenCalledWith('1234')
  })

  it('backspace removes last digit', () => {
    render(<PinInput onComplete={jest.fn()} />)
    fireEvent.click(screen.getByText('5'))
    fireEvent.click(screen.getByText('⌫'))
    expect(screen.getAllByTestId('pin-dot')[0]).not.toHaveClass('bg-blue-500')
  })
})
