import clsx from 'clsx'
import Link from 'next/link'
import { Row } from '../layout/row'
import {
  formatLargeNumber,
  formatMoney,
  formatPercent,
} from 'common/util/format'
import { contractPath, getBinaryProbPercent } from 'web/lib/firebase/contracts'
import { Col } from '../layout/col'
import {
  BinaryContract,
  BountyContract,
  Contract,
  FreeResponseContract,
  MultipleChoiceContract,
  NumericContract,
  PseudoNumericContract,
} from 'common/contract'
import {
  AnswerLabel,
  BinaryContractOutcomeLabel,
  CancelLabel,
  FreeResponseOutcomeLabel,
} from '../outcome-label'
import {
  getOutcomeProbability,
  getProbability,
  getTopAnswer,
} from 'common/calculate'
import { AvatarDetails, MiscDetails, ShowTime } from './contract-details'
import { getExpectedValue, getValueFromBucket } from 'common/calculate-dpm'
import { getColor, ProbBar, QuickBet } from './quick-bet'
import { useContractWithPreload } from 'web/hooks/use-contract'
import { useUser } from 'web/hooks/use-user'
import { track } from '@amplitude/analytics-browser'
import { trackCallback } from 'web/lib/service/analytics'
import { getMappedValue } from 'common/pseudo-numeric'
import { Tooltip } from '../tooltip'

export function ContractCard(props: {
  contract: Contract
  showHotVolume?: boolean
  showTime?: ShowTime
  className?: string
  onClick?: () => void
  hideQuickBet?: boolean
  hideGroupLink?: boolean
}) {
  const {
    showHotVolume,
    showTime,
    className,
    onClick,
    hideQuickBet,
    hideGroupLink,
  } = props
  const contract = useContractWithPreload(props.contract) ?? props.contract
  const { question, outcomeType } = contract
  const { resolution } = contract

  const user = useUser()

  const marketClosed =
    (contract.closeTime || Infinity) < Date.now() || !!resolution

  const showQuickBet =
    user &&
    !marketClosed &&
    (outcomeType === 'BINARY' || outcomeType === 'PSEUDO_NUMERIC') &&
    !hideQuickBet

  return (
    <Row
      className={clsx(
        'relative gap-3 self-start rounded-lg bg-white shadow-md hover:cursor-pointer hover:bg-gray-100',
        className
      )}
    >
      <Col className="group relative flex-1 gap-3 py-4 pl-6">
        {onClick ? (
          <a
            className="absolute top-0 left-0 right-0 bottom-0"
            href={contractPath(contract)}
            onClick={(e) => {
              // Let the browser handle the link click (opens in new tab).
              if (e.ctrlKey || e.metaKey) return

              e.preventDefault()
              track('click market card', {
                slug: contract.slug,
                contractId: contract.id,
              })
              onClick()
            }}
          />
        ) : (
          <Link href={contractPath(contract)}>
            <a
              onClick={trackCallback('click market card', {
                slug: contract.slug,
                contractId: contract.id,
              })}
              className="absolute top-0 left-0 right-0 bottom-0"
            />
          </Link>
        )}
        <AvatarDetails contract={contract} />
        <p
          className="break-words font-semibold text-indigo-700 group-hover:underline group-hover:decoration-indigo-400 group-hover:decoration-2"
          style={{ /* For iOS safari */ wordBreak: 'break-word' }}
        >
          {question}
        </p>

        {(outcomeType === 'FREE_RESPONSE' ||
          outcomeType === 'MULTIPLE_CHOICE') &&
          (resolution ? (
            <FreeResponseOutcomeLabel
              contract={contract}
              resolution={resolution}
              truncate={'long'}
            />
          ) : (
            <FreeResponseTopAnswer contract={contract} truncate="long" />
          ))}

        <MiscDetails
          contract={contract}
          showHotVolume={showHotVolume}
          showTime={showTime}
          hideGroupLink={hideGroupLink}
        />
      </Col>
      {showQuickBet ? (
        <QuickBet contract={contract} user={user} />
      ) : (
        <>
          {outcomeType === 'BINARY' && (
            <BinaryResolutionOrChance
              className="items-center self-center pr-5"
              contract={contract}
            />
          )}

          {outcomeType === 'PSEUDO_NUMERIC' && (
            <PseudoNumericResolutionOrExpectation
              className="items-center self-center pr-5"
              contract={contract}
            />
          )}

          {outcomeType === 'NUMERIC' && (
            <NumericResolutionOrExpectation
              className="items-center self-center pr-5"
              contract={contract}
            />
          )}

          {(outcomeType === 'FREE_RESPONSE' ||
            outcomeType === 'MULTIPLE_CHOICE') && (
            <FreeResponseResolutionOrChance
              className="items-center self-center pr-5 text-gray-600"
              contract={contract}
              truncate="long"
            />
          )}

          {outcomeType === 'BOUNTY' && (
            <BountyValue
              className="items-center self-center pr-5"
              contract={contract}
            />
          )}
          <ProbBar contract={contract} />
        </>
      )}
    </Row>
  )
}

export function BinaryResolutionOrChance(props: {
  contract: BinaryContract
  large?: boolean
  className?: string
}) {
  const { contract, large, className } = props
  const { resolution } = contract
  const textColor = `text-${getColor(contract)}`

  return (
    <Col className={clsx(large ? 'text-4xl' : 'text-3xl', className)}>
      {resolution ? (
        <>
          <div
            className={clsx('text-gray-500', large ? 'text-xl' : 'text-base')}
          >
            Resolved
          </div>
          <BinaryContractOutcomeLabel
            contract={contract}
            resolution={resolution}
          />
        </>
      ) : (
        <>
          <div className={textColor}>{getBinaryProbPercent(contract)}</div>
          <div className={clsx(textColor, large ? 'text-xl' : 'text-base')}>
            chance
          </div>
        </>
      )}
    </Col>
  )
}

export function BountyValue(props: {
  contract: BountyContract
  large?: boolean
  className?: string
}) {
  const { contract, large, className } = props
  const textColor = `text-${getColor(contract)}`
  return (
    <Col className={clsx(large ? 'text-3xl' : 'text-2xl', className)}>
      <div className={textColor}>{formatMoney(contract.prizeTotal)}</div>
      <div className={clsx(textColor, large ? 'text-xl' : 'text-base')}>
        bounty
      </div>
    </Col>
  )
}

function FreeResponseTopAnswer(props: {
  contract: FreeResponseContract | MultipleChoiceContract
  truncate: 'short' | 'long' | 'none'
  className?: string
}) {
  const { contract, truncate } = props

  const topAnswer = getTopAnswer(contract)

  return topAnswer ? (
    <AnswerLabel
      className="!text-gray-600"
      answer={topAnswer}
      truncate={truncate}
    />
  ) : null
}

export function FreeResponseResolutionOrChance(props: {
  contract: FreeResponseContract | MultipleChoiceContract
  truncate: 'short' | 'long' | 'none'
  className?: string
}) {
  const { contract, truncate, className } = props
  const { resolution } = contract

  const topAnswer = getTopAnswer(contract)
  const textColor = `text-${getColor(contract)}`

  return (
    <Col className={clsx(resolution ? 'text-3xl' : 'text-xl', className)}>
      {resolution ? (
        <>
          <div className={clsx('text-base text-gray-500 sm:hidden')}>
            Resolved
          </div>
          {(resolution === 'CANCEL' || resolution === 'MKT') && (
            <FreeResponseOutcomeLabel
              contract={contract}
              resolution={resolution}
              truncate={truncate}
              answerClassName="text-3xl uppercase text-blue-500"
            />
          )}
        </>
      ) : (
        topAnswer && (
          <Row className="items-center gap-6">
            <Col className={clsx('text-3xl', textColor)}>
              <div>
                {formatPercent(getOutcomeProbability(contract, topAnswer.id))}
              </div>
              <div className="text-base">chance</div>
            </Col>
          </Row>
        )
      )}
    </Col>
  )
}

export function NumericResolutionOrExpectation(props: {
  contract: NumericContract
  className?: string
}) {
  const { contract, className } = props
  const { resolution } = contract
  const textColor = `text-${getColor(contract)}`

  const resolutionValue =
    contract.resolutionValue ?? getValueFromBucket(resolution ?? '', contract)

  return (
    <Col className={clsx(resolution ? 'text-3xl' : 'text-xl', className)}>
      {resolution ? (
        <>
          <div className={clsx('text-base text-gray-500')}>Resolved</div>

          {resolution === 'CANCEL' ? (
            <CancelLabel />
          ) : (
            <div className="text-blue-400">
              {formatLargeNumber(resolutionValue)}
            </div>
          )}
        </>
      ) : (
        <>
          <div className={clsx('text-3xl', textColor)}>
            {formatLargeNumber(getExpectedValue(contract))}
          </div>
          <div className={clsx('text-base', textColor)}>expected</div>
        </>
      )}
    </Col>
  )
}

export function PseudoNumericResolutionOrExpectation(props: {
  contract: PseudoNumericContract
  className?: string
}) {
  const { contract, className } = props
  const { resolution, resolutionValue, resolutionProbability } = contract
  const textColor = `text-blue-400`

  const value = resolution
    ? resolutionValue
      ? resolutionValue
      : getMappedValue(contract)(resolutionProbability ?? 0)
    : getMappedValue(contract)(getProbability(contract))

  return (
    <Col className={clsx(resolution ? 'text-3xl' : 'text-xl', className)}>
      {resolution ? (
        <>
          <div className={clsx('text-base text-gray-500')}>Resolved</div>

          {resolution === 'CANCEL' ? (
            <CancelLabel />
          ) : (
            <Tooltip className={textColor} text={value.toFixed(2)}>
              {formatLargeNumber(value)}
            </Tooltip>
          )}
        </>
      ) : (
        <>
          <Tooltip
            className={clsx('text-3xl', textColor)}
            text={value.toFixed(2)}
          >
            {formatLargeNumber(value)}
          </Tooltip>
          <div className={clsx('text-base', textColor)}>expected</div>
        </>
      )}
    </Col>
  )
}
