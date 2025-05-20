/*
 * Copyright 2025 The Dapr Authors
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
limitations under the License.
*/

package io.dapr.springboot.examples.orders.workflow;

import io.dapr.springboot.examples.orders.Order;
import io.dapr.springboot.examples.orders.OrdersRestController;
import io.dapr.workflows.Workflow;
import io.dapr.workflows.WorkflowStub;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Component
public class OrderProcessingWorkflow implements Workflow {

  private final SimpMessagingTemplate simpMessagingTemplate;

  public OrderProcessingWorkflow(SimpMessagingTemplate simpMessagingTemplate) {
    this.simpMessagingTemplate = simpMessagingTemplate;
  }

  private void emitWSEvent(OrdersRestController.Event event) {
    System.out.println("Emitting Event via WS: " + event.toString());
    simpMessagingTemplate.convertAndSend("/topic/events",
            event);
  }

  @Override
  public WorkflowStub create() {
    return ctx -> {
      String instanceId = ctx.getInstanceId();
      Order order = ctx.getInput(Order.class);
      order.setWorkflowId(instanceId);
      ctx.getLogger().info("Let's store the order for tracking: " + order.getItem());
      ctx.callActivity(TrackOrderActivity.class.getName(), order, Order.class).await();
      ctx.getLogger().info("Let's check the if there is stock in the warehouse: " + order.getItem() + ".");
      ctx.callActivity(CheckItemsStockActivity.class.getName(), order, Order.class).await();
      ctx.getLogger().info("Let's wait for the customer to approve the order: " + order.getId());

      emitWSEvent(new OrdersRestController.Event(order));
      order = ctx.waitForExternalEvent("OrderApprovalRequest", Duration.ofMinutes(5), Order.class).await();

      order = ctx.callActivity(ShipOrderActivity.class.getName(), order, Order.class).await();
      ctx.getLogger().info("Congratulations your order is on the way: " + order.getItem() + "!");
      ctx.complete(order);
    };
  }
}


