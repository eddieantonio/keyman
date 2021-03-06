/// <reference path="classical-calculation.ts" />

namespace correction {
  type RealizedInput = ProbabilityMass<Transform>[];  // NOT Distribution - they're masses from separate distributions.

  type TraversableToken<TUnit> = {
    key: TUnit,
    traversal: LexiconTraversal
  }

  export const QUEUE_EDGE_COMPARATOR: models.Comparator<SearchEdge> = function(arg1, arg2) {
    return arg1.currentCost - arg2.currentCost;
  }

  export const QUEUE_NODE_COMPARATOR: models.Comparator<SearchNode> = function(arg1, arg2) {
    return arg1.currentCost - arg2.currentCost;
  }

  export const QUEUE_SPACE_COMPARATOR: models.Comparator<SearchSpaceTier> = function(space1, space2) {
    let node1 = space1.correctionQueue.peek();
    let node2 = space2.correctionQueue.peek();
    
    // Guards, just in case one of the search spaces ever has an empty node.
    if(node1 && node2) {
      return node1.currentCost - node2.currentCost;
    } else if(node2) {
      return 1;
    } else {
      return -1;
    }
  }

  // Represents an 'edge' to a potential 'node' on the (conceptual) graph used to search for best-fitting
  // corrections by the correction-search algorithm.  Stores the cost leading to the new node, though it may be
  // an overestimate when the edit distance is greater than the current search threshold.
  //
  // For nodes with raw edit-distance cost within the current threshold for correction searches, we do have admissibility.
  // If not enough nodes are available within that threshold, however, admissibility may be lost, leaving our search as a
  // heuristic.
  class SearchEdge {
    // Existing calculation from prior rounds to use as source.
    calculation: ClassicalDistanceCalculation<string, EditToken<string>, TraversableToken<string>>;

    // The sequence of input 'samples' taken from specified input distributions.
    optimalInput: RealizedInput;

    // Returns the new input character + probabilty component to add in the current search space's
    // calculation layer.
    get currentInput(): ProbabilityMass<Transform> {
      if(!Array.isArray(this.optimalInput)) {
        return undefined;
      }

      let length = this.optimalInput.length;
      return this.optimalInput[length-1];
    }
    
    get knownCost(): number {
      return this.calculation.getHeuristicFinalCost();
    }

    get inputSamplingCost(): number {
      // TODO:  Optimize so that we're not frequently recomputing this?
      // TODO:  We might should generalize this so that the probability-to-cost function isn't directly hard-coded.
      //        Seems like a decent first conversion function though, at least.
      return this.optimalInput.map(mass => mass.p).reduce((previous, current) => previous + (1 - current), 0);
    }

    // The part used to prioritize our search.
    get currentCost(): number {
      return this.knownCost + this.inputSamplingCost;
    }

    get mapKey(): string {
      // TODO:  correct, as Transforms don't convert nicely to strings.
      let inputString = this.optimalInput.map((value) => '+' + value.sample.insert + '-' + value.sample.deleteLeft).join('');
      let matchString =  this.calculation.matchSequence.map((value) => value.key).join('');
      // TODO:  might should also track diagonalWidth.
      return inputString + models.SENTINEL_CODE_UNIT + matchString;
    }
  }

  // Represents a processed node for the correction-search's search-space's tree-like graph.  May represent
  // internal and 'leaf' nodes on said graph, as well as the overall root of the search.
  //
  // Provides functions usable to enumerate across the node's outward edges to new nodes for continued search.
  // Most of the actual calculations occur as part of this process.
  //
  export class SearchNode {
    calculation: ClassicalDistanceCalculation<string, EditToken<string>, TraversableToken<string>>;
    
    currentTraversal: LexiconTraversal;
    priorInput: RealizedInput;

    constructor(rootTraversal: LexiconTraversal, edge?: SearchEdge) {
      if(edge) {
        this.calculation = edge.calculation;

        if(edge.calculation.lastMatchEntry) {
          this.currentTraversal = edge.calculation.lastMatchEntry.traversal;
        } else {
          this.currentTraversal = rootTraversal;
        }
        this.priorInput = edge.optimalInput;
      } else {
        this.calculation = new ClassicalDistanceCalculation();
        this.currentTraversal = rootTraversal;
        this.priorInput = [];
      }
    }

    get knownCost(): number {
      return this.calculation.getHeuristicFinalCost();
    }

    get inputSamplingCost(): number {
      // TODO:  Optimize so that we're not frequently recomputing this?
      // TODO:  We might should generalize this so that the probability-to-cost function isn't directly hard-coded.
      //        Seems like a decent first conversion function though, at least.
      return this.priorInput.map(mass => mass.p).reduce((previous, current) => previous + (1 - current), 0);
    }

    // The part used to prioritize our search.
    get currentCost(): number {
      return this.knownCost + this.inputSamplingCost;
    }

    buildInsertionEdges(): SearchEdge[] {
      let edges: SearchEdge[] = [];

      for(let lexicalChild of this.currentTraversal.children()) {
        let matchToken = {
          key: lexicalChild.char,
          traversal: lexicalChild.traversal()
        }

        // TODO:  Check against cache(s) & cache results.
        let childCalc = this.calculation.addMatchChar(matchToken);

        let searchChild = new SearchEdge();
        searchChild.calculation = childCalc;
        searchChild.optimalInput = this.priorInput;

        edges.push(searchChild);
      }

      return edges;
    }

    buildDeletionEdges(inputDistribution: Distribution<Transform>): SearchEdge[] {
      let edges: SearchEdge[] = [];

      for(let probMass of inputDistribution) {
        let edgeCalc = this.calculation;
        let transform = probMass.sample;
        if(transform.deleteLeft) {
          edgeCalc = edgeCalc.getSubset(edgeCalc.inputSequence.length - transform.deleteLeft, edgeCalc.matchSequence.length);
        }

        // TODO:  transform.deleteRight currently not supported.

        let inputPath = Array.from(this.priorInput);
        inputPath.push(probMass);
        // Tokenize and iterate over input chars, adding them into the calc.
        for(let i=0; i < transform.insert.length; i++) {
          let char = transform.insert[i];
          if(models.isHighSurrogate(char)) {
            i++;
            char = char + transform.insert[i];
          }

          // TODO:  Check against cache, write results to that cache.
          edgeCalc = edgeCalc.addInputChar({key: char});
        }

        let childEdge = new SearchEdge();
        childEdge.calculation = edgeCalc;
        childEdge.optimalInput = inputPath;

        edges.push(childEdge);
      }

      return edges;
    }

    // While this may SEEM to be unnecessary, note that sometimes substitutions (which are computed
    // via insert + delete) may be lower cost than both just-insert and just-delete.
    buildSubstitutionEdges(inputDistribution: Distribution<Transform>): SearchEdge[] {
      // Handles the 'input' component.
      let intermediateEdges = this.buildDeletionEdges(inputDistribution);
      let edges: SearchEdge[] = [];

      for(let lexicalChild of this.currentTraversal.children()) {
        for(let edge of intermediateEdges) {
          let matchToken = {
            key: lexicalChild.char,
            traversal: lexicalChild.traversal()
          }
  
          // TODO:  Check against cache(s), cache results.
          let childCalc = edge.calculation.addMatchChar(matchToken);
  
          let searchChild = new SearchEdge();
          searchChild.calculation = childCalc;
          searchChild.optimalInput = edge.optimalInput;
  
          edges.push(searchChild);
        }
      }

      return edges;
    }
  }

  class SearchSpaceTier {
    correctionQueue: models.PriorityQueue<SearchEdge>;
    processed: SearchNode[] = [];
    index: number;

    constructor(index: number, initialEdges?: SearchEdge[]) {
      this.index = index;
      this.correctionQueue = new models.PriorityQueue<SearchEdge>(QUEUE_EDGE_COMPARATOR, initialEdges);
    }

    increaseMaxEditDistance() {
      // By extracting the entries from the priority queue and increasing distance outside of it as a batch job,
      // we get an O(N) implementation, rather than the O(N log N) that would result from maintaining the original queue.
      let entries = this.correctionQueue.toArray();

      entries.forEach(function(edge) { edge.calculation = edge.calculation.increaseMaxDistance(); });

      // Since we just modified the stored instances, and the costs may have shifted, we need to re-heapify.
      this.correctionQueue = new models.PriorityQueue<SearchEdge>(QUEUE_EDGE_COMPARATOR, entries);
    }
  }

  // The set of search spaces corresponding to the same 'context' for search.
  // Whenever a wordbreak boundary is crossed, a new instance should be made.
  export class SearchSpace {
    private tierOrdering: SearchSpaceTier[] = [];
    private selectionQueue: models.PriorityQueue<SearchSpaceTier>;
    private inputSequence: Distribution<Transform>[] = [];
    private rootNode: SearchNode;

    // We use an array and not a PriorityQueue b/c batch-heapifying at a single point in time 
    // is cheaper than iteratively building a priority queue.
    private completedPaths: SearchNode[];
    private returnedValues: {[mapKey: string]: SearchNode} = {};

    // Lingering question - can we get away with storing a single bit instead?
    // For now, it's best to wait for the full implementation... just in case we do
    // find a secondary use for this.
    private processedEdgeSet: {[mapKey: string]: SearchEdge} = {};

    constructor(traversalRoot: LexiconTraversal) {
      this.selectionQueue = new models.PriorityQueue<SearchSpaceTier>(QUEUE_SPACE_COMPARATOR);
      this.rootNode = new SearchNode(traversalRoot);

      this.completedPaths = [this.rootNode];
    }

    increaseMaxEditDistance() {
      this.tierOrdering.forEach(function(tier) { tier.increaseMaxEditDistance() });
    }

    addInput(inputDistribution: Distribution<Transform>) {
      this.inputSequence.push(inputDistribution);

      // With a newly-available input, we can extend new input-dependent paths from 
      // our previously-reached 'extractedResults' nodes.
      let newlyAvailableEdges: SearchEdge[] = [];
      let batches = this.completedPaths.map(function(node) {
        let deletions = node.buildDeletionEdges(inputDistribution);
        let substitutions = node.buildSubstitutionEdges(inputDistribution);

        return deletions.concat(substitutions);
      });

      // Don't forget to reset the array; the contained nodes no longer reach the search's end.
      this.completedPaths = [];
      this.returnedValues = {};

      batches.forEach(function(batch) {
        newlyAvailableEdges = newlyAvailableEdges.concat(batch);
      });

      // Now that we've built the new edges, we can efficiently construct the new search tier.
      let tier = new SearchSpaceTier(this.tierOrdering.length, newlyAvailableEdges);
      this.tierOrdering.push(tier);
      this.selectionQueue.enqueue(tier);
    }

    // TODO: will want eventually for reversions and/or backspaces
    removeLastInput() {
      // 1.  truncate all entries from that search tier; we need to 'restore' extractedResults to match
      //     the state that would have existed without the last search tier.
      // 2.  remove the last search tier.  Which may necessitate reconstructing the tier queue, but oh well.
    }

    private hasNextMatchEntry(): boolean {
      return this.selectionQueue.peek().correctionQueue.count > 0;
    }

    findNextMatch(): SearchNode {
      while(this.hasNextMatchEntry()) {
        let bestTier = this.selectionQueue.dequeue();

        let incomingEdge = bestTier.correctionQueue.dequeue();

        // Have we already processed a matching edge?  If so, skip it.
        // We already know the previous edge is of lower cost.
        if(this.processedEdgeSet[incomingEdge.mapKey]) {
          this.selectionQueue.enqueue(bestTier);
          continue;
        } else {
          this.processedEdgeSet[incomingEdge.mapKey] = incomingEdge;
        }

        let currentNode = new SearchNode(this.rootNode.currentTraversal, incomingEdge);

        // Always possible, as this does not require any new input.
        let insertionEdges = currentNode.buildInsertionEdges();
        bestTier.correctionQueue.enqueueAll(insertionEdges);

        if(bestTier.index == this.tierOrdering.length - 1) {
          // It was the final tier - store the node for future reference.
          this.completedPaths.push(currentNode);
          
          // Since we don't modify any other tier, we may simply reinsert the removed tier.
          this.selectionQueue.enqueue(bestTier);

          return currentNode;
        } else {
          // Time to construct new edges for the next tier!
          let nextTier = this.tierOrdering[bestTier.index+1];
          // TODO:  make sure we get this part right.
          let inputIndex = nextTier.index;

          let deletionEdges     = currentNode.buildDeletionEdges(this.inputSequence[inputIndex]);
          let substitutionEdges = currentNode.buildSubstitutionEdges(this.inputSequence[inputIndex]);

          // Note:  we're live-modifying the tier's cost here!  The priority queue loses its guarantees as a result.
          nextTier.correctionQueue.enqueueAll(deletionEdges.concat(substitutionEdges));

          // So, we simply rebuild the selection queue.
          this.selectionQueue = new models.PriorityQueue<SearchSpaceTier>(QUEUE_SPACE_COMPARATOR, this.tierOrdering);

          // We didn't reach an end-node, so we just end the iteration and continue the search.
        }
      }

      // If we've somehow fully exhausted all search options, indicate that none remain.
      return null;
    }

    // Current best guesstimate of how compositor will retrieve ideal corrections.
    *getBestMatches(): Generator<[TraversableToken<string>[][], number]> { 
      // might should also include a 'base cost' parameter of sorts?
      let searchSpace = this;
      let currentReturns: {[mapKey: string]: SearchNode} = {};

      class BatchingAssistant {
        currentCost = Number.MIN_SAFE_INTEGER;
        entries: TraversableToken<string>[][] = [];

        checkAndAdd(entry: SearchNode): [TraversableToken<string>[][], number] | null {
          var result: [TraversableToken<string>[][], number] = null;

          if(entry.currentCost > this.currentCost) {
            result = this.tryFinalize();

            this.currentCost = entry.currentCost;
          }

          // Filter out any duplicated match sequences.  The same match sequence may be reached via
          // different input sequences, after all.
          let outputMapKey = entry.calculation.matchSequence.map(value => value.key).join('');

          // First, ensure the edge has an existing 'shared' cache entry.
          if(!searchSpace.returnedValues[outputMapKey]) {
            searchSpace.returnedValues[outputMapKey] = entry;
          }

          // Check the generator's local returned-value cache - this determines whether or not we
          // need to add a new 'return' to the batch.
          if(!currentReturns[outputMapKey]) {
            this.entries.push(entry.calculation.matchSequence);
            currentReturns[outputMapKey] = entry;
          }

          return result;
        }

        tryFinalize(): [TraversableToken<string>[][], number] | null {
          var result: [TraversableToken<string>[][], number] = null;
          if(this.entries.length > 0) {
            result = [this.entries, this.currentCost];
            this.entries = [];
          }

          return result;
        }
      }

      let batcher = new BatchingAssistant();
      let batch: [TraversableToken<string>[][], number];

      // Stage 1 - if we already have extracted results, build a queue just for them and iterate over it first.
      let returnedValues = Object.values(this.returnedValues);
      if(returnedValues.length > 0) {
        let preprocessedQueue = new models.PriorityQueue<SearchNode>(QUEUE_NODE_COMPARATOR, returnedValues);

        // Build batches of same-cost entries.
        while(preprocessedQueue.count > 0) {
          let entry = preprocessedQueue.dequeue();
          batch = batcher.checkAndAdd(entry);

          if(batch) {
            yield batch;
          }
        }

        // As we only return a batch once all entries of the same cost have been processed, we can safely
        // finalize the last preprocessed group without issue.
        batch = batcher.tryFinalize();
        if(batch) {
          yield batch;
        }
      }

      // Stage 2:  the fun part; actually searching!
      do {
        let newResult = this.findNextMatch();
        if(!newResult) {
          break;
        }
        batch = batcher.checkAndAdd(newResult);

        if(batch) {
          yield batch;
        }
      } while(this.hasNextMatchEntry());

      batch = batcher.tryFinalize();
      if(batch) {
        yield batch;
      }

      return null;
    }
  }

  // -- Code after this point is skeletal at best. --

  export class DistanceModelerOptions {
    minimumPredictions: number;
  }

  export class DistanceModeler {
    private options: DistanceModelerOptions;
    public static readonly DEFAULT_OPTIONS: DistanceModelerOptions = {
      minimumPredictions: 3
    }

    // Keep as a 'rotating cache'.  Includes search spaces corresponding to 'revert' commands.
    private searchSpaces: SearchSpace[] = [];

    private inputs: Distribution<USVString>[] = [];
    private lexiconRoot: LexiconTraversal;

    constructor(lexiconRoot: LexiconTraversal, options: DistanceModelerOptions = DistanceModeler.DEFAULT_OPTIONS) {
      this.lexiconRoot = lexiconRoot;
      this.options = options;
    }

    addInput(input: Distribution<Transform>) {
      // TODO:  add 'addInput' operation
      //        do search space things
    }
  }
}